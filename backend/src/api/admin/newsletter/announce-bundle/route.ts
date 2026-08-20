import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, QueryContext } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { productLink } from "../../../../lib/customer-email"
import { sendCampaign } from "../../../../lib/newsletter-campaign"
import { presentBundle } from "../../../../modules/bundled-product/presentation"
import { requireWorkingUnsubscribe } from "../campaigns/route"

/**
 * Announces one bundle to every active subscriber.
 *
 * The e-mail shows real items at real prices, so this route loads the bundle
 * exactly the way the storefront does — same fields, same
 * `calculated_price` context (`/store/bundle-products/[id]`), shaped by the
 * same `presentBundle` — and refuses to send anything it cannot price. An
 * announcement with a made-up number is worse than no announcement.
 *
 * The default campaign key is `bundle:{bundle_id}`: announcing the same
 * bundle twice by accident sends nothing new. Passing an explicit `key` is
 * how a deliberate re-announcement (say, after a restock) is made.
 */
export const PostAnnounceBundleSchema = z.object({
  bundle_id: z.string().min(1),
  key: z.string().min(1).optional(),
})

type PostAnnounceBundle = z.infer<typeof PostAnnounceBundleSchema>

const amountOf = (variant: any): number | null => {
  const amount = Number(variant?.calculated_price?.calculated_amount)
  return Number.isFinite(amount) ? amount : null
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostAnnounceBundle>,
  res: MedusaResponse
) {
  const payload = (req.validatedBody || req.body) as PostAnnounceBundle

  // A bundle announcement to the subscriber list is obchodní sdělení like any
  // other campaign — without a working unsubscribe link it must not exist.
  requireWorkingUnsubscribe()

  const query = req.scope.resolve("query")

  // The shop sells in CZK; prefer the CZK region, fall back to the first.
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const region =
    (regions as any[]).find(
      (candidate) => String(candidate.currency_code).toLowerCase() === "czk"
    ) ?? (regions as any[])[0]

  if (!region) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Nelze rozeslat oznámení: obchod nemá žádný region, ze kterého by šly spočítat ceny."
    )
  }

  const priceContext = QueryContext({
    region_id: region.id,
    currency_code: region.currency_code,
  })

  const { data } = await query.graph(
    {
      entity: "bundle",
      fields: [
        "*",
        "product.*",
        "product.variants.*",
        "product.variants.calculated_price.*",
        "items.*",
        "items.product.*",
        "items.product.variants.*",
        "items.product.variants.calculated_price.*",
        "items.product_variant.*",
        "items.product_variant.calculated_price.*",
      ],
      filters: { id: payload.bundle_id },
      context: {
        product: {
          variants: { calculated_price: priceContext },
        },
        items: {
          product: {
            variants: { calculated_price: priceContext },
          },
          product_variant: { calculated_price: priceContext },
        },
      },
    },
    { throwIfKeyNotFound: true }
  )

  const presented = presentBundle(data[0])

  const bundleProduct = presented.product
  if (!bundleProduct?.handle) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Nelze rozeslat oznámení: balíček nemá vlastní produkt, na který by e-mail mohl odkazovat."
    )
  }
  if (bundleProduct.status && bundleProduct.status !== "published") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Nelze rozeslat oznámení: produkt balíčku není publikovaný — odkaz v e-mailu by vedl na stránku, která neexistuje."
    )
  }

  const items = (presented.items as any[]).map((item) => {
    // Fixed component: the one variant's real price. Customer-selects: the
    // cheapest variant — the same „od" price presentBundle's bundle minimum
    // is built from, so the e-mail's ledger adds up.
    const unitPrice =
      item.variant_mode === "fixed_variant"
        ? amountOf(item.product_variant)
        : (item.price_range?.min as number | null)

    return {
      id: item.id as string,
      product_title: (item.product?.title ?? "") as string,
      variant_title:
        item.variant_mode === "fixed_variant"
          ? ((item.product_variant?.title ?? "") as string)
          : "",
      thumbnail: (item.product?.thumbnail ?? undefined) as string | undefined,
      unit_price: unitPrice,
      quantity: Number(item.quantity ?? 1),
    }
  })

  const totalPrice = Number(presented.calculated_bundle_price?.min)

  if (
    !items.length ||
    items.some((item) => item.unit_price === null || !item.product_title) ||
    !Number.isFinite(totalPrice) ||
    totalPrice <= 0
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Nelze rozeslat oznámení: balíčku chybí položky nebo spočítané ceny. E-mail s vymyšlenými čísly neposíláme."
    )
  }

  const bundle = {
    id: presented.id as string,
    name: presented.title as string,
    description: (bundleProduct.description ?? "") as string,
    thumbnail: (bundleProduct.thumbnail ?? undefined) as string | undefined,
    items: items as Array<{
      id: string
      product_title: string
      variant_title: string
      thumbnail?: string
      unit_price: number
      quantity: number
    }>,
    total_price: totalPrice,
    ...(presented.discount_percentage != null
      ? { discount_percentage: Number(presented.discount_percentage) }
      : {}),
    bundle_url: productLink(bundleProduct.handle),
  }

  const campaignKey = payload.key ?? `bundle:${payload.bundle_id}`

  const { sent } = await sendCampaign(req.scope, {
    campaignKey,
    template: "bundle-published",
    data: {
      subject: `Nový balíček ${bundle.name} je k nahlédnutí`,
      bundle,
    },
  })

  res.json({ ok: true, sent })
}
