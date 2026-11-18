/**
 * Výprodej — čistá část (bez databáze): nastavení v popisu ceníku a výběr
 * výrobků. Zápisy a souvislosti viz `lib/vyprodej.ts`.
 */

export const VYPRODEJ_PREFIX = "kz:vyprodej:"

/** `time` = od–do; `stock` = dokud jsou kusy skladem. */
export type VyprodejType = "time" | "stock"

export type VyprodejConfig = {
  type: VyprodejType
  percent: number
  collection_ids: string[]
  category_ids: string[]
  product_ids: string[]
  /** Vyřazené ručně z výprodeje, který je bere přes kolekci / kategorii. */
  excluded_product_ids: string[]
  /** Výrobky, které výprodej právě zlevňuje (spočítané při posledním srovnání). */
  members: string[]
  /** Otisk zapsaných cen — beze změny se ceník nepřepisuje. */
  sig?: string
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

export const vyprodejDescription = (config: VyprodejConfig) =>
  `${VYPRODEJ_PREFIX}${JSON.stringify(config)}`

export const parseVyprodej = (description: string | null | undefined): VyprodejConfig | null => {
  if (!description || !description.startsWith(VYPRODEJ_PREFIX)) return null
  let raw: any
  try {
    raw = JSON.parse(description.slice(VYPRODEJ_PREFIX.length))
  } catch {
    return null
  }
  if (!raw || typeof raw !== "object") return null
  const percent = Number(raw.percent)
  if (!Number.isFinite(percent) || percent <= 0) return null
  const config: VyprodejConfig = {
    type: raw.type === "stock" ? "stock" : "time",
    percent,
    collection_ids: strings(raw.collection_ids),
    category_ids: strings(raw.category_ids),
    product_ids: strings(raw.product_ids),
    excluded_product_ids: strings(raw.excluded_product_ids),
    members: strings(raw.members),
  }
  if (typeof raw.sig === "string") config.sig = raw.sig
  return config
}

export type CatalogProduct = {
  id: string
  status?: string | null
  collection_id?: string | null
  category_ids: string[]
  metadata?: Record<string, unknown> | null
  variants: Array<{ id: string; manage_inventory?: boolean | null }>
}

export type CategoryInfo = { parent_id: string | null; collection_id: string | null }

export type MemberContext = {
  categories: Map<string, CategoryInfo>
  /** Dostupné kusy podle provedení (jen sledovaný sklad). */
  available: Map<string, number>
  /** Výrobky, které už zlevňuje jiný (dřív založený) výprodej. */
  takenByOther: Set<string>
}

/**
 * Do výprodeje nikdy: dárkový poukaz, poškozený kus (má vlastní slevu),
 * cena po domluvě, zakázka, balíček (cena se skládá z kusů).
 */
export const vyprodejBlockReason = (metadata?: Record<string, unknown> | null): string | null => {
  const meta = metadata ?? {}
  const yes = (key: string) => meta[key] === true || meta[key] === "true"
  if (yes("gift_voucher") || yes("voucher_custom_amount")) return "Dárkový poukaz se nezlevňuje."
  if (yes("clearance")) return "Poškozený kus má vlastní slevu."
  if (yes("price_on_request")) return "U ceny po domluvě se výprodej nedělá."
  if (yes("made_to_order")) return "Zakázka do výprodeje nepatří."
  if (yes("is_bundle")) return "Balíček má cenu ze svých kusů — zlevněte kusy."
  return null
}

/** Kategorie a všichni její předci. */
const withAncestors = (categoryId: string, categories: Map<string, CategoryInfo>) => {
  const out: string[] = []
  let current: string | null = categoryId
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    out.push(current)
    current = categories.get(current)?.parent_id ?? null
  }
  return out
}

export type VyprodejVia = "product" | "category" | "collection"

/** Proč je výrobek ve výběru (nebo `null`, když není). */
export const vyprodejVia = (
  product: CatalogProduct,
  config: Pick<VyprodejConfig, "collection_ids" | "category_ids" | "product_ids">,
  categories: Map<string, CategoryInfo>
): VyprodejVia | null => {
  if (config.product_ids.includes(product.id)) return "product"
  const chain = product.category_ids.flatMap((id) => withAncestors(id, categories))
  if (chain.some((id) => config.category_ids.includes(id))) return "category"
  const collections = new Set<string>(
    [product.collection_id ?? null, ...chain.map((id) => categories.get(id)?.collection_id ?? null)].filter(
      (id): id is string => Boolean(id)
    )
  )
  if (config.collection_ids.some((id) => collections.has(id))) return "collection"
  return null
}

export const resolveVyprodejMembers = (
  products: CatalogProduct[],
  config: VyprodejConfig,
  ctx: MemberContext
) => {
  const productIds: string[] = []
  const variantIds: string[] = []
  const skipped = { nelze: 0, jinyVyprodej: 0, vyprodano: 0 }

  for (const product of products) {
    if (product.status !== "published") continue
    if (config.excluded_product_ids.includes(product.id)) continue
    if (!vyprodejVia(product, config, ctx.categories)) continue
    if (vyprodejBlockReason(product.metadata)) {
      skipped.nelze += 1
      continue
    }
    if (ctx.takenByOther.has(product.id)) {
      skipped.jinyVyprodej += 1
      continue
    }
    const variants =
      config.type === "stock"
        ? product.variants.filter(
            (variant) => variant.manage_inventory && (ctx.available.get(variant.id) ?? 0) > 0
          )
        : product.variants
    if (!variants.length) {
      skipped.vyprodano += 1
      continue
    }
    productIds.push(product.id)
    variantIds.push(...variants.map((variant) => variant.id))
  }

  return { productIds, variantIds, skipped }
}
