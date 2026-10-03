import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

import { CLEARANCE_METADATA_KEY } from "../../../lib/clearance"

/**
 * „Poškozený kus z existujícího produktu" (§ požadavek 3. 10. 2026).
 *
 * ## Proč to je samostatný endpoint
 *
 * Poškozený kus JE ten samý produkt, jen jeden konkrétní s vadou a levnější.
 * Zakládat ho od nuly znamená přepsat všechno znovu — fotky, popis, materiál,
 * rozměry. Tady se místo toho vybere zdrojový produkt + varianta a data se
 * zkopírují; majitelka dodá jen fotku vady, popis vady a akční cenu.
 *
 * ## Cena bez slevy ve Slevy+
 *
 * Záměrně se NEZAKLÁDÁ žádná sleva/price-list (bylo by to jednorázové promo,
 * co jen zaplevelí Slevy+). „Sleva" je čistě: cena varianty = akční cena,
 * původní cena v `metadata.clearance_original_price`. Storefront z toho vykreslí
 * přeškrtnutí (ProductPrice). Popis vady v `metadata.clearance_damage` se taky
 * ukáže zákazníkovi.
 *
 * ## Co se stane po prodeji
 *
 * Kus je `clearance` (jako každý výprodej), takže po vyprodání ho job
 * `retire-sold-out-clearance` schová a zároveň archivuje — zůstane i s cenou
 * v archivu Poškozených, odkud se dá obnovit, kdyby se poškodil další stejný.
 */

export const PostDamagedProductSchema = z.object({
  source_product_id: z.string().min(1),
  source_variant_id: z.string().min(1),
  /** Akční cena v Kč (hlavní jednotka, ne haléře). */
  sale_price: z.number().positive(),
  /** Původní cena v Kč — pro přeškrtnutí. Výchozí = cena zdrojové varianty. */
  original_price: z.number().positive().optional(),
  /** Co je to za poškození — ukáže se zákazníkovi. */
  damage: z.string().trim().max(2000).optional(),
  /** Fotky vady. Když prázdné, zkopírují se fotky zdrojového produktu. */
  images: z.array(z.object({ url: z.string().min(1) })).optional(),
  /** Vlastní název; výchozí = „<název zdroje> — poškozený". */
  title: z.string().trim().min(1).optional(),
})

type PostDamagedProductBody = z.infer<typeof PostDamagedProductSchema>

const SOURCE_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "material",
  "weight",
  "length",
  "height",
  "width",
  "hs_code",
  "mid_code",
  "origin_country",
  "thumbnail",
  "collection_id",
  "images.url",
  "categories.id",
  "variants.id",
  "variants.prices.amount",
  "variants.prices.currency_code",
]

const czkAmount = (variant: any): number | null => {
  const czk = (variant?.prices ?? []).find(
    (price: any) => String(price?.currency_code).toLowerCase() === "czk"
  )
  return czk ? Number(czk.amount) : null
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostDamagedProductBody>,
  res: MedusaResponse
) {
  const body = req.validatedBody
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: products } = await query.graph({
    entity: "product",
    fields: SOURCE_FIELDS,
    filters: { id: body.source_product_id },
  })
  const source = products[0] as any
  if (!source) {
    return res.status(404).json({ message: "Zdrojový produkt neexistuje." })
  }

  const sourceVariant = (source.variants ?? []).find(
    (variant: any) => variant.id === body.source_variant_id
  )
  if (!sourceVariant) {
    return res
      .status(404)
      .json({ message: "Zvolená varianta u zdrojového produktu neexistuje." })
  }

  const originalPrice =
    body.original_price ?? czkAmount(sourceVariant) ?? body.sale_price

  // Fotky vady, nebo fotky zdroje, když žádné nedodané.
  const copiedImages =
    body.images && body.images.length
      ? body.images.map((image) => ({ url: image.url }))
      : (source.images ?? [])
          .map((image: any) => image?.url)
          .filter((url: unknown): url is string => Boolean(url))
          .map((url: string) => ({ url }))

  const thumbnail = copiedImages[0]?.url ?? source.thumbnail ?? undefined
  const damage = body.damage?.trim() || ""

  /*
   * Prodejní kanál — bez něj je kus pro obchod NEVIDITELNÝ.
   *
   * createProductsWorkflow (narozdíl od admin product.create) výchozí prodejní
   * kanál nepřipojí, takže poškozený kus store API vůbec nevrátilo („not_found"
   * i po publikaci) a filtr „Poškozené" byl prázdný. Stejná past jako u balíčků.
   */
  const storeModule = req.scope.resolve(Modules.STORE)
  const [store] = await storeModule.listStores(
    {},
    { select: ["id", "default_sales_channel_id"] as never }
  )
  const defaultSalesChannelId = (store as any)?.default_sales_channel_id as
    | string
    | undefined

  const productInput: any = {
    title: body.title?.trim() || `${source.title} — poškozený`,
    status: "draft",
    ...(defaultSalesChannelId
      ? { sales_channels: [{ id: defaultSalesChannelId }] }
      : {}),
    subtitle: source.subtitle ?? undefined,
    description: source.description ?? undefined,
    material: source.material ?? undefined,
    weight: source.weight ?? undefined,
    length: source.length ?? undefined,
    height: source.height ?? undefined,
    width: source.width ?? undefined,
    hs_code: source.hs_code ?? undefined,
    mid_code: source.mid_code ?? undefined,
    origin_country: source.origin_country ?? undefined,
    collection_id: source.collection_id ?? undefined,
    category_ids: (source.categories ?? [])
      .map((category: any) => category?.id)
      .filter((id: unknown): id is string => Boolean(id)),
    images: copiedImages,
    thumbnail,
    metadata: {
      [CLEARANCE_METADATA_KEY]: true,
      clearance_source_product_id: source.id,
      clearance_source_variant_id: sourceVariant.id,
      clearance_original_price: originalPrice,
      clearance_damage: damage,
    },
    options: [{ title: "Provedení", values: ["Standardní"] }],
    variants: [
      {
        title: "Standardní",
        // Jeden fyzický kus: hlídá sklad a NEprodává se po vyprodání
        // (žádný druhý se nevyrobí) — stejně jako běžný poškozený.
        manage_inventory: true,
        allow_backorder: false,
        options: { Provedení: "Standardní" },
        prices: [{ currency_code: "czk", amount: body.sale_price }],
      },
    ],
  }

  const { result } = await createProductsWorkflow(req.scope).run({
    input: { products: [productInput] },
  })

  const created = Array.isArray(result) ? result[0] : result
  const productId = created?.id
  if (!productId) {
    return res
      .status(500)
      .json({ message: "Poškozený kus se nepodařilo založit." })
  }

  // Nastavit skladem přesně 1 kus. createProductsWorkflow založí u
  // manage_inventory varianty skladovou položku; dohledáme ji a nastavíme stav.
  try {
    const { data: withInventory } = await query.graph({
      entity: "product",
      fields: ["id", "variants.inventory_items.inventory_item_id"],
      filters: { id: productId },
    })
    const inventoryItemId = (withInventory[0] as any)?.variants?.[0]
      ?.inventory_items?.[0]?.inventory_item_id

    if (inventoryItemId) {
      const stockLocation = req.scope.resolve(Modules.STOCK_LOCATION) as any
      const locations = await stockLocation.listStockLocations({}, { take: 2 })
      if (locations.length === 1) {
        const locationId = locations[0].id
        const inventory = req.scope.resolve(Modules.INVENTORY) as any
        const [level] = await inventory.listInventoryLevels({
          inventory_item_id: inventoryItemId,
          location_id: locationId,
        })
        if (level) {
          await inventory.updateInventoryLevels([
            {
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              stocked_quantity: 1,
            },
          ])
        } else {
          await inventory.createInventoryLevels([
            {
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              stocked_quantity: 1,
            },
          ])
        }
      }
    }
  } catch (error) {
    // Sklad se dá doplnit ručně v editoru; kus přesto vznikl.
    logger.warn(
      `[poškozený] skladem 1 se nepodařilo nastavit pro ${productId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  res.status(201).json({ product: { id: productId } })
}
