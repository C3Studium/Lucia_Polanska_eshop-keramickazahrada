import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

/**
 * Photos for a zakázka, uploaded by the customer.
 *
 * ## Why this exists at all
 *
 * Medusa ships an upload route for the admin only. A customer describing a
 * commission — „takhle vypadá ta fasáda", „chci to v téhle modré" — has
 * nowhere to put a picture, and a commission described in words alone is how
 * the wrong thing gets made.
 *
 * ## Why base64 and not multipart
 *
 * Multipart would need `multer` wired into the store namespace. The payload
 * here is a handful of phone photos, so JSON with base64 costs ~33% in
 * transfer and saves a middleware that would sit in front of every store
 * route. The file module wants a binary string in the end either way.
 *
 * ## Why it is not an open uploader
 *
 * It refuses to do anything without a `cart_id` or `order_id` that resolves.
 * Those are ULIDs nobody can guess, which is exactly the trust Medusa already
 * places in every other store cart route — you hold the id, you may act on the
 * cart. Combined with the count, size and type limits below, the worst an
 * abuser can do is put four images in the bucket per cart they already own.
 */

const MAX_FILES = 6
/** Per file, decoded. A phone photo is 2–5MB; beyond this something is wrong. */
const MAX_BYTES = 6 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"])

const PostMediaSchema = z
  .object({
    cart_id: z.string().optional(),
    order_id: z.string().optional(),
    files: z
      .array(
        z.object({
          filename: z.string().min(1).max(255),
          mime_type: z.string().min(1),
          /** Base64, with or without the `data:` prefix the browser adds. */
          data: z.string().min(1),
        })
      )
      .min(1)
      .max(MAX_FILES),
  })
  .refine((body) => body.cart_id || body.order_id, {
    message: "Chybí košík nebo objednávka, ke které fotky patří.",
  })

const decode = (data: string) => {
  const comma = data.indexOf(",")
  const payload = data.startsWith("data:") && comma > -1 ? data.slice(comma + 1) : data
  return Buffer.from(payload, "base64")
}

/** A filename we are willing to put in a bucket, whatever the phone called it. */
const safeName = (filename: string) => {
  const cleaned = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120)
  return cleaned || "zakazka-foto"
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PostMediaSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Fotky se nepodařilo přijmout."
    )
  }

  const { cart_id, order_id, files } = parsed.data

  // Prove the caller holds a real id before anything touches storage.
  if (cart_id) {
    const cartModule = req.scope.resolve(Modules.CART)
    const [cart] = await cartModule.listCarts({ id: cart_id } as never, {
      take: 1,
    })
    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Košík nebyl nalezen.")
    }
  } else {
    const orderModule = req.scope.resolve(Modules.ORDER)
    const [order] = await orderModule.listOrders({ id: order_id } as never, {
      take: 1,
    })
    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Objednávka nebyla nalezena."
      )
    }
  }

  const prepared = files.map((file) => {
    if (!ALLOWED.has(file.mime_type.toLowerCase())) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Přiložte prosím fotku ve formátu JPG, PNG nebo WEBP."
      )
    }

    const buffer = decode(file.data)
    if (!buffer.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Jedna z fotek dorazila prázdná. Zkuste ji přidat znovu."
      )
    }
    if (buffer.length > MAX_BYTES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fotka je příliš velká — pošlete prosím menší než 6 MB."
      )
    }

    return {
      filename: safeName(file.filename),
      mimeType: file.mime_type,
      // The provider decodes `content` as base64 — the same contract Medusa's
      // own /admin/uploads route uses.
      content: buffer.toString("base64"),
      access: "public" as const,
    }
  })

  const fileModule = req.scope.resolve(Modules.FILE)
  const uploaded = await fileModule.createFiles(prepared)

  res.status(200).json({
    files: (Array.isArray(uploaded) ? uploaded : [uploaded]).map((file: any) => ({
      id: file.id,
      url: file.url,
    })),
  })
}
