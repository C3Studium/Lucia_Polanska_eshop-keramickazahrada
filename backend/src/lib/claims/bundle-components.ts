import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import type { ClaimComponentDetail, ClaimOrderItemDetail } from "./order-items"
import {
  MONEY_EPSILON,
  requestRefunds,
  round2,
  toNumber,
  type MoneyRequest,
} from "./refund-rules"

/**
 * Balíček po komponentách (docs/reklamace-a-zruseni.md §13.5).
 *
 * ## Jak balíček vypadá na objednávce
 *
 * Košík balíček ROZKLÁDÁ: `add-bundle-to-cart` přidá každou komponentu jako
 * vlastní řádek s `metadata.bundle_id` (viz `prepare-bundle-cart-data`). Takové
 * řádky jsou pro refundaci obyčejné položky — vrací se po řádcích, žádné
 * komponenty netřeba. Rozpis podle §13.5 se týká řádku, jehož PRODUKT je
 * balíček (`product.metadata.is_bundle` — balíček prodaný jako jeden řádek,
 * např. přidaný přímo přes produkt). U něj se komponenty dohledají z modulu
 * `bundled-product` (link `bundle ↔ product`) a každá dostane poměrnou cenu.
 *
 * ## `unit_share`
 *
 * Aktuální cena varianty komponenty × množství, přepočtená tak, aby
 * Σ komponent × množství = `unit_total` balíčku (zákazník zaplatil balíček,
 * ne součet komponent). Zaokrouhlení se dorovná na poslední komponentě.
 * Bez cen (varianta bez ceny v měně objednávky, komponenta bez varianty) se
 * `unit_total` rozdělí ROVNÝM DÍLEM po kusech a `pricing_note` to řekne —
 * majitelka pak ví, že číslo je dohoda, ne ceník.
 */

export type BundleComponentSource = {
  product_id: string
  variant_id: string | null
  title: string
  thumbnail: string | null
  /** Na jeden balíček. */
  quantity: number
  /** Aktuální cena varianty komponenty (hlavní jednotky), null = neznámá. */
  price: number | null
}

export const EVEN_SPLIT_NOTE =
  "Cena komponent není k dispozici — cena balíčku rozdělena rovným dílem po kusech."

export type UnitShareSplit = {
  /** Za kus komponenty, ve stejném pořadí jako vstup. */
  shares: number[]
  pricing_note: string | null
}

/** ČISTÉ: poměrné ceny komponent tak, aby Σ `share × quantity` = `unitTotal`. */
export const splitUnitShare = (
  unitTotal: number,
  components: Array<{ quantity: number; price: number | null }>
): UnitShareSplit => {
  const total = Math.max(0, round2(toNumber(unitTotal)))
  const quantities = components.map((component) => Math.max(0, toNumber(component.quantity)))
  const pieces = quantities.reduce((sum, quantity) => sum + quantity, 0)
  if (!components.length || pieces <= 0) {
    return { shares: components.map(() => 0), pricing_note: null }
  }

  const allPriced = components.every(
    (component) => component.price !== null && Number.isFinite(component.price) && component.price >= 0
  )
  const weighted = allPriced
    ? components.reduce(
        (sum, component, index) => sum + (component.price as number) * quantities[index],
        0
      )
    : 0

  let shares: number[]
  let note: string | null = null
  if (allPriced && weighted > MONEY_EPSILON) {
    const factor = total / weighted
    shares = components.map((component) => round2((component.price as number) * factor))
  } else {
    note = EVEN_SPLIT_NOTE
    const perPiece = round2(total / pieces)
    shares = quantities.map(() => perPiece)
  }

  // Dorovnání zaokrouhlení na poslední komponentě s nenulovým množstvím —
  // součet musí sedět na haléř s tím, co zákazník za balíček zaplatil.
  const sum = round2(shares.reduce((acc, share, index) => acc + share * quantities[index], 0))
  const drift = round2(total - sum)
  if (Math.abs(drift) >= 0.01) {
    for (let index = shares.length - 1; index >= 0; index -= 1) {
      if (quantities[index] > 0) {
        shares[index] = round2(shares[index] + drift / quantities[index])
        break
      }
    }
  }
  return { shares, pricing_note: note }
}

const componentKey = (lineItemId: string, productId: string) => `${lineItemId}:${productId}`

/** Σ vrácených kusů komponent (`refunds[].lines` typu `component`) přes všechny žádosti. */
export const refundedComponentQuantitiesOf = (
  requests: MoneyRequest[]
): Map<string, number> => {
  const totals = new Map<string, number>()
  for (const request of requests) {
    for (const refund of requestRefunds(request)) {
      for (const line of refund.lines ?? []) {
        if (line.type !== "component" || !line.line_item_id || !line.product_id) continue
        const key = componentKey(line.line_item_id, line.product_id)
        totals.set(key, (totals.get(key) ?? 0) + Math.max(0, toNumber(line.quantity)))
      }
    }
  }
  return totals
}

/**
 * ČISTÉ: komponenty jedné položky-balíčku s poměrnou cenou a stropy.
 * `refundable_quantity` = `quantity × refundable_quantity balíčku − už vrácené
 * kusy komponenty` — vrácený celý balíček (řádek `item`) ubírá i komponentám.
 */
export const buildClaimComponents = (
  item: ClaimOrderItemDetail,
  sources: BundleComponentSource[],
  refunded: Map<string, number>
): { components: ClaimComponentDetail[]; pricing_note: string | null } => {
  const split = splitUnitShare(item.unit_total, sources)
  const components = sources.map((source, index) => {
    const refundedQuantity = refunded.get(componentKey(item.line_item_id, source.product_id)) ?? 0
    const available = Math.max(0, source.quantity * item.refundable_quantity - refundedQuantity)
    return {
      product_id: source.product_id,
      variant_id: source.variant_id,
      title: source.title,
      thumbnail: source.thumbnail,
      quantity: source.quantity,
      unit_share: split.shares[index] ?? 0,
      refunded_quantity: refundedQuantity,
      refundable_quantity: available,
    }
  })
  return { components, pricing_note: split.pricing_note }
}

/** Položky s doplněnými komponentami tam, kde je zdroj (balíček); ostatní beze změny. */
export const attachComponents = (
  items: ClaimOrderItemDetail[],
  sourcesByLine: Map<string, BundleComponentSource[]>,
  requests: MoneyRequest[]
): ClaimOrderItemDetail[] => {
  const refunded = refundedComponentQuantitiesOf(requests)
  return items.map((item) => {
    const sources = item.is_bundle ? sourcesByLine.get(item.line_item_id) : undefined
    if (!sources?.length) {
      return item
    }
    const built = buildClaimComponents(item, sources, refunded)
    return { ...item, components: built.components, pricing_note: built.pricing_note }
  })
}

const one = <T>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value ?? undefined

const priceOf = (variant: any): number | null => {
  const amount = Number(variant?.calculated_price?.calculated_amount)
  return Number.isFinite(amount) ? amount : null
}

/**
 * Zdroje komponent pro položky-balíčky objednávky — jeden dotaz na modul
 * `bundled-product` (link vede jen z balíčku na produkt, proto se čtou všechny
 * balíčky a filtrují podle `product.id` položek). Ceny variant v měně/regionu
 * objednávky přes `QueryContext` jako v `add-bundle-to-cart`. Best-effort:
 * když modul nebo ceny selžou, vrací prázdnou mapu a detail balíček nerozepíše.
 */
export const loadBundleComponentSources = async (
  scope: MedusaContainer,
  order: { region_id?: string | null; currency_code?: string | null },
  items: ClaimOrderItemDetail[]
): Promise<Map<string, BundleComponentSource[]>> => {
  const result = new Map<string, BundleComponentSource[]>()
  const bundleLines = items.filter((item) => item.is_bundle && item.product_id)
  if (!bundleLines.length) {
    return result
  }
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const priceContext = QueryContext({
      region_id: order.region_id ?? undefined,
      currency_code: order.currency_code ?? undefined,
    })
    const { data: bundles } = await query.graph({
      entity: "bundle",
      fields: [
        "id",
        "title",
        "product.id",
        "items.id",
        "items.quantity",
        "items.display_order",
        "items.variant_mode",
        "items.product.id",
        "items.product.title",
        "items.product.thumbnail",
        "items.product.variants.id",
        "items.product.variants.title",
        "items.product.variants.calculated_price.*",
        "items.product_variant.id",
        "items.product_variant.title",
        "items.product_variant.calculated_price.*",
      ],
      context: {
        items: {
          product: { variants: { calculated_price: priceContext } },
          product_variant: { calculated_price: priceContext },
        },
      },
    })

    const byProduct = new Map<string, any>()
    for (const bundle of bundles as any[]) {
      for (const product of [bundle?.product].flat().filter(Boolean)) {
        byProduct.set(product.id, bundle)
      }
    }

    for (const line of bundleLines) {
      const bundle = byProduct.get(line.product_id as string)
      if (!bundle) continue
      const sources: BundleComponentSource[] = [...(bundle.items ?? [])]
        .sort((a: any, b: any) => (a?.display_order ?? 0) - (b?.display_order ?? 0))
        .map((entry: any) => {
          const product = one<any>(entry?.product)
          const fixed = one<any>(entry?.product_variant)
          const variants: any[] = product?.variants ?? []
          // Pevná varianta má cenu rovnou; u „zákazník vybírá" nevíme, kterou
          // zvolil — bere se nejlevnější (ve prospěch zákazníka při vrácení
          // nic nepřeplatíme) a její id.
          const chosen =
            entry?.variant_mode === "fixed_variant" && fixed
              ? fixed
              : variants.reduce<any>((best, variant) => {
                  const price = priceOf(variant)
                  if (price === null) return best
                  const bestPrice = best ? priceOf(best) : null
                  return bestPrice === null || price < bestPrice ? variant : best
                }, null) ?? variants[0] ?? null
          return {
            product_id: String(product?.id ?? entry?.product_id ?? ""),
            variant_id: chosen?.id ?? null,
            title: String(product?.title ?? bundle.title ?? "Komponenta"),
            thumbnail: product?.thumbnail ?? null,
            quantity: Math.max(1, Math.trunc(toNumber(entry?.quantity)) || 1),
            price: priceOf(chosen),
          }
        })
        .filter((source) => source.product_id)
      if (sources.length) {
        result.set(line.line_item_id, sources)
      }
    }
  } catch {
    // Balíčky jsou doplněk detailu — bez nich se položka vrací jako celek.
  }
  return result
}
