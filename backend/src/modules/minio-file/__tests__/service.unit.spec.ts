const clients: any[] = []

jest.mock("minio", () => ({
  Client: jest.fn().mockImplementation((options: any) => {
    const client = {
      options,
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn(),
      setBucketPolicy: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue({}),
    }
    clients.push(client)
    return client
  }),
}))

import MinioFileProviderService from "../service"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any
const file = {
  filename: "Dárkový poukaz.JPG",
  mimeType: "image/jpeg",
  content: Buffer.from("obrázek").toString("base64"),
} as any

beforeEach(() => {
  clients.length = 0
})

describe("minio-file provider", () => {
  it("keeps the MinIO behaviour: bucket in the path, public-read ACL, bucket managed", async () => {
    const service = new MinioFileProviderService({ logger }, {
      endPoint: "bucket-production-2be7.up.railway.app",
      accessKey: "a",
      secretKey: "b",
    })
    const result = await service.upload(file)
    const client = clients[0]

    expect(result.url).toMatch(
      /^https:\/\/bucket-production-2be7\.up\.railway\.app\/medusa-media\/darkovy-poukaz-[0-9A-Z]{26}\.jpg$/
    )
    expect(client.putObject.mock.calls[0][4]).toHaveProperty("x-amz-acl", "public-read")
    expect(client.bucketExists).toHaveBeenCalledWith("medusa-media")
    expect(client.options.region).toBeUndefined()
  })

  it("talks to R2: public domain without the bucket, no ACL, bucket left alone", async () => {
    const service = new MinioFileProviderService({ logger }, {
      endPoint: "https://abc123.eu.r2.cloudflarestorage.com/",
      accessKey: "a",
      secretKey: "b",
      bucket: "keramickazahrada-media",
      region: "auto",
      publicUrl: "https://img.matejforejt.com/",
    })
    const result = await service.upload(file)
    const client = clients[0]

    expect(client.options.endPoint).toBe("abc123.eu.r2.cloudflarestorage.com")
    expect(client.options.region).toBe("auto")
    expect(result.url).toMatch(
      /^https:\/\/img\.matejforejt\.com\/darkovy-poukaz-[0-9A-Z]{26}\.jpg$/
    )
    expect(result.key).toBe(result.url.split("/").pop())
    expect(client.putObject.mock.calls[0][0]).toBe("keramickazahrada-media")
    expect(client.putObject.mock.calls[0][4]).not.toHaveProperty("x-amz-acl")
    expect(client.bucketExists).not.toHaveBeenCalled()
    expect(client.setBucketPolicy).not.toHaveBeenCalled()
  })
})
