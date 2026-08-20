import { AbstractFileProviderService, MedusaError } from '@medusajs/framework/utils';
import { Logger } from '@medusajs/framework/types';
import { 
  ProviderUploadFileDTO,
  ProviderDeleteFileDTO,
  ProviderFileResultDTO,
  ProviderGetFileDTO
} from '@medusajs/framework/types';
import { Client } from 'minio';
import path from 'path';
import { ulid } from 'ulid';

type InjectedDependencies = {
  logger: Logger
}

interface MinioServiceConfig {
  endPoint: string
  accessKey: string
  secretKey: string
  bucket?: string
}

export interface MinioFileProviderOptions {
  endPoint: string
  accessKey: string
  secretKey: string
  bucket?: string
}

const DEFAULT_BUCKET = 'medusa-media'

/**
 * Undo a UTF-8 name that was read as latin1 — „dárkový" arriving as „dÃ¡rkovÃ½".
 *
 * Medusa's /admin/uploads parses the multipart body with busboy's default
 * charset, so every filename with a Czech letter reaches the provider mangled.
 * Re-reading those bytes as UTF-8 restores the name; if the result does not
 * round-trip (the name was never mojibake), the original is kept untouched.
 */
const repairMojibake = (name: string): string => {
  if (!/[\u00c0-\u00ff]/.test(name)) return name
  try {
    const repaired = Buffer.from(name, 'latin1').toString('utf8')
    if (repaired.includes('\ufffd')) return name
    return Buffer.from(repaired, 'utf8').toString('latin1') === name
      ? repaired
      : name
  } catch {
    return name
  }
}

/** Diacritics folded away, everything else that is not ASCII replaced. */
const toAscii = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')

/**
 * A filename an S3 key, a URL and a human can all live with: ASCII, lowercase,
 * single dashes, no spaces. Names that fold away to nothing (all-emoji, all-CJK)
 * still get a key, because the ulid that follows makes it unique either way.
 */
const slugifyFilename = (value: string): string =>
  toAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'soubor'

/**
 * Service to handle file storage using MinIO.
 */
class MinioFileProviderService extends AbstractFileProviderService {
  static identifier = 'minio-file'
  protected readonly config_: MinioServiceConfig
  protected readonly logger_: Logger
  protected client: Client
  protected readonly bucket: string

  constructor({ logger }: InjectedDependencies, options: MinioFileProviderOptions) {
    super()
    this.logger_ = logger
    this.config_ = {
      endPoint: options.endPoint,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      bucket: options.bucket
    }

    // Use provided bucket or default
    this.bucket = this.config_.bucket || DEFAULT_BUCKET
    this.logger_.info(`MinIO service initialized with bucket: ${this.bucket}`)

    // Initialize Minio client with hardcoded SSL settings
    this.client = new Client({
      endPoint: this.config_.endPoint,
      port: 443,
      useSSL: true,
      accessKey: this.config_.accessKey,
      secretKey: this.config_.secretKey
    })

    // Initialize bucket and policy
    this.initializeBucket().catch(error => {
      this.logger_.error(`Failed to initialize MinIO bucket: ${error.message}`)
    })
  }

  static validateOptions(options: Record<string, any>) {
    const requiredFields = [
      'endPoint',
      'accessKey',
      'secretKey'
    ]

    requiredFields.forEach((field) => {
      if (!options[field]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `${field} is required in the provider's options`
        )
      }
    })
  }

  private async initializeBucket(): Promise<void> {
    try {
      // Check if bucket exists
      const bucketExists = await this.client.bucketExists(this.bucket)
      
      if (!bucketExists) {
        // Create the bucket
        await this.client.makeBucket(this.bucket)
        this.logger_.info(`Created bucket: ${this.bucket}`)

        // Set bucket policy to allow public read access
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`]
            }
          ]
        }

        await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy))
        this.logger_.info(`Set public read policy for bucket: ${this.bucket}`)
      } else {
        this.logger_.info(`Using existing bucket: ${this.bucket}`)
        
        // Verify/update policy on existing bucket
        try {
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicRead',
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`]
              }
            ]
          }
          await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy))
          this.logger_.info(`Updated public read policy for existing bucket: ${this.bucket}`)
        } catch (policyError) {
          this.logger_.warn(`Failed to update policy for existing bucket: ${policyError.message}`)
        }
      }
    } catch (error) {
      this.logger_.error(`Error initializing bucket: ${error.message}`)
      throw error
    }
  }

  async upload(
    file: ProviderUploadFileDTO
  ): Promise<ProviderFileResultDTO> {
    if (!file) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file provided'
      )
    }

    if (!file.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No filename provided'
      )
    }

    try {
      const originalName = repairMojibake(file.filename)
      const parsedFilename = path.parse(originalName)
      /*
       * The object key is built from a slug, not from the name as typed. Two
       * things went wrong when it was not: Medusa's upload route decodes the
       * multipart filename as latin1, so „dárkový poukaz.jpg" reached us as
       * „dÃ¡rkovÃ½ poukaz.jpg" and that mojibake became the key; and the spaces
       * survived into the URL we hand back, which then has to be percent-encoded
       * by every consumer to work at all. Both were visible on the collection
       * photos uploaded in admin Rozdělení. `repairMojibake` above undoes the
       * latin1 misread first, so the slug comes out of the real Czech name.
       */
      const fileKey = `${slugifyFilename(parsedFilename.name)}-${ulid()}${parsedFilename.ext.toLowerCase()}`
      /*
       * Medusa's own /admin/uploads route hands `content` over base64-encoded —
       * decoding it as 'binary' (latin1) stored the base64 TEXT verbatim, which
       * is why every admin-uploaded image served as ASCII instead of JPEG.
       * Internal callers (made-to-order media, iDoklad PDFs) follow the same
       * contract and encode to base64 before calling createFiles.
       */
      const content = Buffer.from(file.content, 'base64')

      // Upload file with public-read access
      await this.client.putObject(
        this.bucket,
        fileKey,
        content,
        content.length,
        {
          'Content-Type': file.mimeType,
          // S3 signs metadata headers as ASCII — a Czech filename („růže.jpg")
          // made every such upload fail with a signature mismatch.
          'x-amz-meta-original-filename': toAscii(originalName),
          'x-amz-acl': 'public-read'
        }
      )

      // Generate URL using the endpoint and bucket. The key is already
      // URL-safe, but encoding it keeps the promise explicit: what we return
      // is a URL that can be used as-is.
      const url = `https://${this.config_.endPoint}/${this.bucket}/${encodeURIComponent(fileKey)}`

      this.logger_.info(`Successfully uploaded file ${fileKey} to MinIO bucket ${this.bucket}`)

      return {
        url,
        key: fileKey
      }
    } catch (error) {
      this.logger_.error(`Failed to upload file: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to upload file: ${error.message}`
      )
    }
  }

  async delete(
    fileData: ProviderDeleteFileDTO
  ): Promise<void> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      await this.client.removeObject(this.bucket, fileData.fileKey)
      this.logger_.info(`Successfully deleted file ${fileData.fileKey} from MinIO bucket ${this.bucket}`)
    } catch (error) {
      // Log error but don't throw if file doesn't exist
      this.logger_.warn(`Failed to delete file ${fileData.fileKey}: ${error.message}`)
    }
  }

  async getPresignedDownloadUrl(
    fileData: ProviderGetFileDTO
  ): Promise<string> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        fileData.fileKey,
        24 * 60 * 60 // URL expires in 24 hours
      )
      this.logger_.info(`Generated presigned URL for file ${fileData.fileKey}`)
      return url
    } catch (error) {
      this.logger_.error(`Failed to generate presigned URL: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to generate presigned URL: ${error.message}`
      )
    }
  }
}

export default MinioFileProviderService
