import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createPriceListsWorkflow,
  deletePriceListsWorkflow,
  updatePriceListsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Sleva u výrobku (18. 11. 2026, přání majitele: „sleva přímo u ceny
 * produktu — procenta, od kdy do kdy, vypnout; a ve Slevách seznam všech
 * zlevněných výrobků").
 *
 * ## Proč nativní ceník
 *
 * Cenu v Meduse mění jen ceník (price list) typu `sale`. Obchod ho už umí
 * ukázat — přeškrtnutá původní cena a „−20 %" (storefront `price_type ===
 * "sale"`), období `starts_at`/`ends_at` hlídá Medusa sama a košík počítá
 * akční cenu bez další logiky. Žádný druhý cenový mechanismus.
 *
 * Každý zlevněný výrobek má **vlastní** ceník. Pozná se podle popisu
 * `kz:product-sale:<id výrobku>:<procenta>` — ceník nemá metadata a popis je
 * jediné pole, které Medusa nikde zákazníkovi neukáže. Seznam ve Slevách,
 * detail výrobku i přepočet se řídí jen tímhle ceníkem, žádná kopie
 * v metadatech výrobku, která by se mohla rozejít.
 *
 * ## Když se změní cena
 *
 * Ceník drží absolutní částky. Změní-li Lucie cenu (nebo ranní přepočet
 * z kurzu ČNB cizí měny), musí se akční cena spočítat znovu — to dělá
 * `refreshProductSale` ze subscriberu `product-sale-refresh` na
 * `product-variant.updated/created`.
 */

export const PRODUCT_SALE_PREFIX = "kz:product-sale:"

export type ProductSaleState = "off" | "scheduled" | "running" | "ended"

export type ProductSale = {
  price_list_id: string
  product_id: string
  percent: number
  status: "active" | "draft"
  starts_at: string | null
  ends_at: string | null
  state: ProductSaleState
}

export type ProductSaleInput = {
  percent: number
  starts_at: string | null
  ends_at: string | null
  enabled: boolean
}

type PriceRow = {
  currency_code: string
  amount: number | string | null
  price_list_id?: string | null
  rules_count?: number | null
}

type VariantPrices = { id: string; prices?: PriceRow[] | null }

export const saleDescription = (productId: string, percent: number) =>
  `${PRODUCT_SALE_PREFIX}${productId}:${percent}`

export const parseSaleDescription = (
  description: string | null | undefined
): { productId: string; percent: number } | null => {
  if (!description || !description.startsWith(PRODUCT_SALE_PREFIX)) return null
  const rest = description.slice(PRODUCT_SALE_PREFIX.length)
  const split = rest.lastIndexOf(":")
  if (split <= 0) return null
  const productId = rest.slice(0, split)
  const percent = Number(rest.slice(split + 1))
  if (!Number.isFinite(percent) || percent <= 0) return null
  return { productId, percent }
}

/**
 * Základní ceny provedení — bez cen z ceníků (jinak by se zlevňovala už
 * zlevněná cena) a bez cen s pravidly (regionální, množstevní).
 */
export const basePrices = (variant: VariantPrices) =>
  (variant.prices ?? [])
    .filter((price) => !price.price_list_id && !Number(price.rules_count ?? 0))
    .map((price) => ({
      currency_code: String(price.currency_code).toLowerCase(),
      amount: Number(price.amount),
    }))
    .filter((price) => Number.isFinite(price.amount))

const roundFor = (currency: string, value: number) =>
  currency === "czk" ? Math.round(value) : Math.round(value * 100) / 100

export const salePrices = (variants: VariantPrices[], percent: number) =>
  variants.flatMap((variant) =>
    basePrices(variant)
      .filter((price) => price.amount > 0)
      .map((price) => ({
        variant_id: variant.id,
        currency_code: price.currency_code,
        amount: Math.max(1, roundFor(price.currency_code, (price.amount * (100 - percent)) / 100)),
      }))
  )

export const saleState = (
  list: { status: string; starts_at: string | Date | null; ends_at: string | Date | null },
  now: Date = new Date()
): ProductSaleState => {
  if (list.status !== "active") return "off"
  const t = now.getTime()
  if (list.starts_at && new Date(list.starts_at).getTime() > t) return "scheduled"
  if (list.ends_at && new Date(list.ends_at).getTime() < t) return "ended"
  return "running"
}

const toIso = (value: unknown): string | null =>
  value ? new Date(value as string).toISOString() : null

/* Všechny slevy u výrobků. Ceníků je v obchodě desítky, filtr v paměti stačí. */
const loadSaleLists = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "price_list",
    fields: ["id", "description", "status", "starts_at", "ends_at"],
    pagination: { take: 1000, skip: 0 },
  })
  return (data as any[]).flatMap((list) => {
    const parsed = parseSaleDescription(list.description)
    if (!parsed) return []
    const sale: ProductSale = {
      price_list_id: list.id,
      product_id: parsed.productId,
      percent: parsed.percent,
      status: list.status === "active" ? "active" : "draft",
      starts_at: toIso(list.starts_at),
      ends_at: toIso(list.ends_at),
      state: saleState(list),
    }
    return [sale]
  })
}

export const listProductSales = loadSaleLists

export const getProductSale = async (container: MedusaContainer, productId: string) =>
  (await loadSaleLists(container)).find((sale) => sale.product_id === productId) ?? null

/*
 * Zápisy jednoho výrobku jdou za sebou. Tři provedení změněná naráz vydají
 * tři události a souběžné „smazat a založit" by nechalo dva ceníky.
 */
const fronta = new Map<string, Promise<unknown>>()
const zaSebou = <T>(productId: string, work: () => Promise<T>): Promise<T> => {
  const previous = fronta.get(productId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(work)
  fronta.set(productId, next)
  void next.finally(() => {
    if (fronta.get(productId) === next) fronta.delete(productId)
  }).catch(() => undefined)
  return next
}

const deleteLists = async (container: MedusaContainer, ids: string[]) => {
  if (!ids.length) return
  await deletePriceListsWorkflow(container).run({ input: { ids } })
}

const writeSale = async (
  container: MedusaContainer,
  productId: string,
  input: ProductSaleInput
): Promise<ProductSale> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "variants.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
      "variants.prices.rules_count",
    ],
    filters: { id: productId },
  })
  const product = (products as any[])[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Výrobek nebyl nalezen.")
  }

  const prices = salePrices(product.variants ?? [], input.percent)
  if (!prices.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Výrobek nemá cenu, ze které by šlo slevu spočítat."
    )
  }

  const existing = (await loadSaleLists(container)).filter(
    (sale) => sale.product_id === productId
  )

  const { result } = await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: `Sleva ${input.percent} % — ${product.title}`,
          description: saleDescription(productId, input.percent),
          status: (input.enabled ? "active" : "draft") as any,
          starts_at: input.starts_at,
          ends_at: input.ends_at,
          prices,
        },
      ],
    },
  })
  const created = (result as any[])[0]

  // Starý ceník až po založení nového — kdyby založení selhalo, sleva
  // zůstane, jak byla, místo aby zmizela.
  await deleteLists(
    container,
    existing.map((sale) => sale.price_list_id)
  )

  return {
    price_list_id: created.id,
    product_id: productId,
    percent: input.percent,
    status: input.enabled ? "active" : "draft",
    starts_at: toIso(input.starts_at),
    ends_at: toIso(input.ends_at),
    state: saleState({
      status: input.enabled ? "active" : "draft",
      starts_at: input.starts_at,
      ends_at: input.ends_at,
    }),
  }
}

export const setProductSale = (
  container: MedusaContainer,
  productId: string,
  input: ProductSaleInput
) => zaSebou(productId, () => writeSale(container, productId, input))

export const setProductSaleEnabled = (
  container: MedusaContainer,
  productId: string,
  enabled: boolean
) =>
  zaSebou(productId, async () => {
    const sale = await getProductSale(container, productId)
    if (!sale) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Výrobek slevu nemá.")
    }
    await updatePriceListsWorkflow(container).run({
      input: {
        price_lists_data: [{ id: sale.price_list_id, status: (enabled ? "active" : "draft") as any }],
      },
    })
    const status: ProductSale["status"] = enabled ? "active" : "draft"
    return { ...sale, status, state: saleState({ ...sale, status }) }
  })

export const removeProductSale = (container: MedusaContainer, productId: string) =>
  zaSebou(productId, async () => {
    const lists = (await loadSaleLists(container)).filter(
      (sale) => sale.product_id === productId
    )
    await deleteLists(
      container,
      lists.map((sale) => sale.price_list_id)
    )
    return lists.length
  })

/** Po změně ceny: stejná procenta a období, nové částky. Bez slevy nic. */
export const refreshProductSale = (container: MedusaContainer, productId: string) =>
  zaSebou(productId, async () => {
    const sale = await getProductSale(container, productId)
    if (!sale) return null
    return writeSale(container, productId, {
      percent: sale.percent,
      starts_at: sale.starts_at,
      ends_at: sale.ends_at,
      enabled: sale.status === "active",
    })
  })
