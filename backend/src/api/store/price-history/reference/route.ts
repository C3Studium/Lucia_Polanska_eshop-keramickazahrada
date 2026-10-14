import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import {
  addDays,
  computePriceReference,
  HISTORY_LOOKBACK_DAYS,
  pragueDay,
  toAmount,
  type PriceHistoryPoint,
  type PriceKind,
  type PriceReference,
} from "../../../../lib/price-reference"
import { PRICE_HISTORY_MODULE } from "../../../../modules/price-history"
import type PriceHistoryModuleService from "../../../../modules/price-history/service"

/**
 * `GET /store/price-history/reference?variant_ids=a,b&currency_code=czk`
 *
 * Nejnižší cena za 30 dní před slevou (§ 12a ZOS) pro zlevněné varianty —
 * storefront ji ukazuje u ceny na stránce výrobku i na kartě v obchodě.
 *
 * Veřejná jako každá store routa (stačí publikovatelný klíč, který Medusa
 * vynucuje sama). Vrací jen čísla, která zákazník na webu stejně vidí.
 *
 * Jestli varianta ve slevě JE, rozhoduje živá cena (stejný cenový kontext
 * jako storefront: oblast dané měny), ne historie — sleva založená před
 * hodinou tu je hned, i když ji job ještě nezapsal. Výpočet je
 * `computePriceReference` (pravidlo a jeho okrajové případy jsou tam).
 *
 * Odpověď: `{ references: { [variant_id]: { lowest_30d, sale_started_on, complete } } }`
 * — varianta mimo slevu má `lowest_30d: null`.
 */

const MAX_VARIANTS = 100

const parseVariantIds = (raw: unknown): string[] => {
  const values = Array.isArray(raw) ? raw : [raw]
  const ids = values
    .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
    .map((value) => value.trim())
    .filter((value) => /^[A-Za-z0-9_]{1,64}$/.test(value))
  return [...new Set(ids)].slice(0, MAX_VARIANTS)
}

const parseCurrency = (raw: unknown): string | null => {
  const value = (typeof raw === "string" ? raw : "czk").trim().toLowerCase()
  return /^[a-z]{3}$/.test(value) ? value : null
}

const EMPTY: PriceReference = {
  lowest_30d: null,
  sale_started_on: null,
  complete: false,
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const variantIds = parseVariantIds(req.query.variant_ids)
  const currency = parseCurrency(req.query.currency_code)

  if (!variantIds.length || !currency) {
    res.json({ references: {} })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const regionModule = req.scope.resolve(Modules.REGION)
  const pricingModule = req.scope.resolve(Modules.PRICING)
  const history = req.scope.resolve<PriceHistoryModuleService>(
    PRICE_HISTORY_MODULE
  )

  const today = pragueDay()

  const [region] = (await regionModule.listRegions(
    { currency_code: currency },
    { select: ["id"], take: 1 }
  )) as Array<{ id: string }>

  // Živá cena — je varianta ve slevě teď, jakou má běžnou cenu a který
  // price-list slevu dává.
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "calculated_price.*"],
    filters: { id: variantIds },
    context: {
      calculated_price: QueryContext({
        currency_code: currency,
        ...(region?.id ? { region_id: region.id } : {}),
      }),
    },
  })

  type Live = { onSale: boolean; base: number | null; priceListId: string | null }
  const live = new Map<string, Live>()
  for (const variant of variants as any[]) {
    const price = variant?.calculated_price
    const base = toAmount(price?.original_amount)
    const current = toAmount(price?.calculated_amount)
    const onSale =
      price?.calculated_price?.price_list_type === "sale" &&
      base != null &&
      current != null &&
      current < base
    live.set(variant.id, {
      onSale,
      base,
      priceListId: onSale ? price?.calculated_price?.price_list_id ?? null : null,
    })
  }

  const priceListIds = [
    ...new Set(
      [...live.values()]
        .map((entry) => entry.priceListId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const startsOnByList = new Map<string, string | null>()
  if (priceListIds.length) {
    const lists = (await pricingModule.listPriceLists(
      { id: priceListIds },
      { select: ["id", "starts_at"] }
    )) as Array<{ id: string; starts_at?: string | Date | null }>
    for (const list of lists) {
      startsOnByList.set(
        list.id,
        list.starts_at ? pragueDay(new Date(list.starts_at)) : null
      )
    }
  }

  const onSaleIds = variantIds.filter((id) => live.get(id)?.onSale)
  const entriesByVariant = new Map<string, PriceHistoryPoint[]>()
  if (onSaleIds.length) {
    const rows = (await history.listPriceHistoryEntries({
      variant_id: onSaleIds,
      currency_code: currency,
      recorded_on: { $gte: addDays(today, -HISTORY_LOOKBACK_DAYS) },
    })) as any[]
    for (const row of rows) {
      const amount = toAmount(row.amount)
      if (amount == null) continue
      const list = entriesByVariant.get(row.variant_id) ?? []
      list.push({
        recorded_on: String(row.recorded_on),
        kind: row.kind as PriceKind,
        amount,
      })
      entriesByVariant.set(row.variant_id, list)
    }
  }

  const references: Record<string, PriceReference> = {}
  for (const id of variantIds) {
    const state = live.get(id)
    if (!state?.onSale) {
      references[id] = EMPTY
      continue
    }
    references[id] = computePriceReference({
      entries: entriesByVariant.get(id) ?? [],
      today,
      onSaleNow: true,
      priceListStartsOn: state.priceListId
        ? startsOnByList.get(state.priceListId) ?? null
        : null,
      currentBase: state.base,
    })
  }

  // Storefront si odpověď drží sám (Next revalidate); krátká cache tu jen
  // tlumí opakované dotazy z téže stránky.
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json({ references })
}
