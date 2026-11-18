import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  batchPriceListPricesWorkflow,
  createPriceListsWorkflow,
  deletePriceListsWorkflow,
  updatePriceListsWorkflow,
} from "@medusajs/medusa/core-flows"
import { applyDiscountableRule, DISCOUNTABLE_PRODUCT_FIELDS } from "./discountable"
import { getInventoryAlerts } from "./inventory-alerts"
import {
  listProductSales,
  salePrices,
  saleState,
  setProductSaleEnabled,
  type ProductSaleState,
} from "./product-sale"
import {
  parseVyprodej,
  resolveVyprodejMembers,
  vyprodejDescription,
  vyprodejVia,
  type CatalogProduct,
  type CategoryInfo,
  type VyprodejConfig,
  type VyprodejType,
  type VyprodejVia,
} from "./vyprodej-config"
import revalidateStorefront from "../subscribers/revalidate-storefront"

/**
 * Výprodej (18. 11. 2026, přání majitele: „Kampaně přejmenovat na
 * Výprodeje — pro celou kolekci, kategorii nebo vybrané výrobky; časový,
 * nebo do vyprodání zásob; výprodej ruší jakoukoli jinou slevu").
 *
 * ## Jak je postavený
 *
 * Jako sleva u výrobku (`lib/product-sale.ts`): nativní akční ceník Medusy.
 * Nastavení (typ, procenta, rozsah, kdo je zrovna zlevněný) je v popisu
 * ceníku `kz:vyprodej:{…}`, název výprodeje je název ceníku, období jsou
 * `starts_at`/`ends_at` ceníku, vypnutí je stav `draft`. Obchod tak ukáže
 * přeškrtnutou cenu bez úprav a období hlídá Medusa.
 *
 * ## Kdo je ve výprodeji
 *
 * Rozsah se počítá pořád znovu (`syncVyprodeje`): nový výrobek v kategorii
 * ve výprodeji se zlevní sám, výrobek přesunutý jinam vypadne. Výrobek může
 * být jen v jednom běžícím výprodeji — bere ho ten dřív založený.
 *
 * - **Časový:** všechna provedení výrobků v rozsahu, od–do.
 * - **Do vyprodání zásob:** jen provedení, která jsou skladem. Vyprodané
 *   provedení ze slevy vypadne (objednávka „na objednávku" už je za plnou
 *   cenu); když se vyprodá všechno, výprodej skončí.
 *
 * ## Přednost
 *
 * Výprodej > sleva u výrobku > slevové kódy. Výrobek ve výprodeji má vlastní
 * slevu vypnutou (a zapnout nejde) a nedostane slevový kód; zlevněný výrobek
 * nedostane slevový kód (`lib/discountable.ts`).
 */

export type Vyprodej = {
  id: string
  title: string
  status: "active" | "draft"
  starts_at: string | null
  ends_at: string | null
  created_at: string | null
  state: ProductSaleState
  config: VyprodejConfig
}

const toIso = (value: unknown): string | null =>
  value ? new Date(value as string).toISOString() : null

export const loadVyprodeje = async (container: MedusaContainer): Promise<Vyprodej[]> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "price_list",
    fields: ["id", "title", "description", "status", "starts_at", "ends_at", "created_at"],
    pagination: { take: 1000, skip: 0 },
  })
  return (data as any[])
    .flatMap((list) => {
      const config = parseVyprodej(list.description)
      if (!config) return []
      const item: Vyprodej = {
        id: list.id,
        title: list.title,
        status: list.status === "active" ? "active" : "draft",
        starts_at: toIso(list.starts_at),
        ends_at: toIso(list.ends_at),
        created_at: toIso(list.created_at),
        state: saleState(list),
        config,
      }
      return [item]
    })
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
}

type CatalogRow = CatalogProduct & {
  title: string
  thumbnail: string | null
  variants: Array<{ id: string; manage_inventory?: boolean | null; prices?: any[] }>
}

const loadCatalog = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: products }, { data: categories }, alerts] = await Promise.all([
    query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "thumbnail",
        "status",
        "collection_id",
        "metadata",
        "categories.id",
        "variants.id",
        "variants.manage_inventory",
        "variants.prices.amount",
        "variants.prices.currency_code",
        "variants.prices.price_list_id",
        "variants.prices.rules_count",
      ],
      pagination: { take: 5000, skip: 0 },
    }),
    query.graph({
      entity: "product_category",
      fields: ["id", "parent_category_id", "metadata"],
      pagination: { take: 1000, skip: 0 },
    }),
    getInventoryAlerts(container),
  ])

  const categoryMap = new Map<string, CategoryInfo>(
    (categories as any[]).map((category) => [
      category.id,
      {
        parent_id: category.parent_category_id ?? null,
        collection_id: (category.metadata ?? {}).collection_id ?? null,
      },
    ])
  )
  const available = new Map<string, number>()
  for (const bucket of ["low", "out", "ok"] as const) {
    for (const row of alerts[bucket]) available.set(row.variant_id, row.available ?? 0)
  }
  const rows: CatalogRow[] = (products as any[]).map((product) => ({
    id: product.id,
    title: product.title,
    thumbnail: product.thumbnail ?? null,
    status: product.status,
    collection_id: product.collection_id ?? null,
    category_ids: (product.categories ?? []).map((category: any) => category.id),
    metadata: product.metadata ?? {},
    variants: product.variants ?? [],
  }))
  return { products: rows, categories: categoryMap, available }
}

/* Všechny zápisy výprodejů jdou za sebou — srovnání bere celý katalog. */
let fronta: Promise<unknown> = Promise.resolve()
const zaSebou = <T>(work: () => Promise<T>): Promise<T> => {
  const next = fronta.catch(() => undefined).then(work)
  fronta = next
  return next
}

const isOver = (vyprodej: Pick<Vyprodej, "state">) => vyprodej.state === "ended"

/**
 * Srovnat všechny výprodeje s katalogem: kdo do nich patří, jejich ceny,
 * vypnout vlastní slevy členů, slevové kódy, obnovit obchod.
 */
const syncAllNow = async (container: MedusaContainer) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const vyprodeje = await loadVyprodeje(container)
  if (!vyprodeje.length) return { changed: false }

  const catalog = await loadCatalog(container)
  const variantsById = new Map(
    catalog.products.flatMap((product) => product.variants.map((variant) => [variant.id, variant]))
  )
  const taken = new Set<string>()
  const touched = new Set<string>()
  const owned = new Set<string>()
  let changed = false

  for (const vyprodej of vyprodeje) {
    /* Vypnutý a skončený výrobky nedrží — vezme je jiný výprodej nebo
       se vrátí jejich vlastní sleva. Naplánovaný je drží (ať se dva
       výprodeje nepřekryjí), vlastní slevu ale vypne až běžící. */
    if (vyprodej.state === "off" || vyprodej.state === "ended") continue
    const resolved = resolveVyprodejMembers(catalog.products, vyprodej.config, {
      categories: catalog.categories,
      available: catalog.available,
      takenByOther: taken,
    })
    resolved.productIds.forEach((id) => {
      taken.add(id)
      if (vyprodej.state === "running") owned.add(id)
    })

    const prices = salePrices(
      resolved.variantIds.map((id) => variantsById.get(id)).filter(Boolean) as any[],
      vyprodej.config.percent
    )
    const sig = JSON.stringify(
      prices.map((price) => `${price.variant_id}:${price.currency_code}:${price.amount}`).sort()
    )

    /* Do vyprodání zásob: všechno prodané → výprodej končí. */
    const soldOut =
      vyprodej.config.type === "stock" &&
      vyprodej.state === "running" &&
      vyprodej.config.members.length > 0 &&
      resolved.productIds.length === 0

    if (sig === vyprodej.config.sig && !soldOut) continue
    changed = true
    vyprodej.config.members.forEach((id) => touched.add(id))
    resolved.productIds.forEach((id) => touched.add(id))

    const { data: lists } = await query.graph({
      entity: "price_list",
      fields: ["id", "prices.id"],
      filters: { id: vyprodej.id },
    })
    const oldPriceIds = ((lists as any[])[0]?.prices ?? []).map((price: any) => price.id)
    await batchPriceListPricesWorkflow(container).run({
      input: {
        data: {
          id: vyprodej.id,
          create: prices as any,
          update: [],
          delete: oldPriceIds,
        },
      },
    })

    await updatePriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          {
            id: vyprodej.id,
            description: vyprodejDescription({
              ...vyprodej.config,
              members: resolved.productIds,
              sig,
            }),
            ...(soldOut ? { ends_at: new Date().toISOString() } : {}),
          } as any,
        ],
      },
    })
    if (soldOut) logger.info(`[výprodej] „${vyprodej.title}" — všechno prodané, výprodej skončil.`)
  }

  /* Výprodej ruší vlastní slevu výrobku. */
  for (const sale of await listProductSales(container)) {
    if (owned.has(sale.product_id) && sale.status === "active") {
      await setProductSaleEnabled(container, sale.product_id, false).catch(() => undefined)
      touched.add(sale.product_id)
      changed = true
    }
  }

  if (touched.size) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: DISCOUNTABLE_PRODUCT_FIELDS,
      filters: { id: [...touched] },
    })
    await applyDiscountableRule(container, products as any[]).catch((error) =>
      logger.warn(`[výprodej] Slevové kódy se nepodařilo srovnat: ${String(error?.message ?? error)}`)
    )
  }

  if (changed) {
    await revalidateStorefront({
      container,
      event: { name: "vyprodej.synced", data: {} },
    } as never)
  }
  return { changed }
}

export const syncVyprodeje = (container: MedusaContainer) => zaSebou(() => syncAllNow(container))

/* Události v katalogu chodí v dávkách (uložení výrobku = několik událostí) —
   srovná se jednou, chvíli po poslední. */
let odlozeno: ReturnType<typeof setTimeout> | null = null
export const scheduleVyprodejSync = (container: MedusaContainer, delayMs = 2500) => {
  if (odlozeno) clearTimeout(odlozeno)
  odlozeno = setTimeout(() => {
    odlozeno = null
    void syncVyprodeje(container).catch((error) =>
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(`[výprodej] Srovnání se nepodařilo: ${String(error?.message ?? error)}`)
    )
  }, delayMs)
}

export type VyprodejInput = {
  title: string
  type: VyprodejType
  percent: number
  starts_at: string | null
  ends_at: string | null
  collection_ids: string[]
  category_ids: string[]
  product_ids: string[]
}

export const createVyprodej = async (container: MedusaContainer, input: VyprodejInput) => {
  const config: VyprodejConfig = {
    type: input.type,
    percent: input.percent,
    collection_ids: input.collection_ids,
    category_ids: input.category_ids,
    product_ids: input.product_ids,
    excluded_product_ids: [],
    members: [],
  }
  const { result } = await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: input.title,
          description: vyprodejDescription(config),
          status: "active" as any,
          starts_at: input.starts_at,
          ends_at: input.type === "stock" ? null : input.ends_at,
          prices: [],
        },
      ],
    },
  })
  const id = (result as any[])[0].id as string
  await syncVyprodeje(container)
  const created = (await loadVyprodeje(container)).find((vyprodej) => vyprodej.id === id)
  if (!created?.config.members.length) {
    await deletePriceListsWorkflow(container).run({ input: { ids: [id] } })
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      input.type === "stock"
        ? "Ve výběru není žádný výrobek se skladem, který by šel zlevnit."
        : "Ve výběru není žádný výrobek, který by šel zlevnit."
    )
  }
  return created
}

export type VyprodejPatch = Partial<VyprodejInput> & {
  enabled?: boolean
  add_product_ids?: string[]
  remove_product_ids?: string[]
}

export const updateVyprodej = async (
  container: MedusaContainer,
  id: string,
  patch: VyprodejPatch
) => {
  const current = (await loadVyprodeje(container)).find((vyprodej) => vyprodej.id === id)
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Výprodej nebyl nalezen.")
  const config: VyprodejConfig = { ...current.config }
  if (patch.type) config.type = patch.type
  if (patch.percent) config.percent = patch.percent
  if (patch.collection_ids) config.collection_ids = patch.collection_ids
  if (patch.category_ids) config.category_ids = patch.category_ids
  if (patch.product_ids) config.product_ids = patch.product_ids
  for (const productId of patch.add_product_ids ?? []) {
    config.excluded_product_ids = config.excluded_product_ids.filter((other) => other !== productId)
    if (!config.product_ids.includes(productId)) config.product_ids = [...config.product_ids, productId]
  }
  for (const productId of patch.remove_product_ids ?? []) {
    config.product_ids = config.product_ids.filter((other) => other !== productId)
    if (!config.excluded_product_ids.includes(productId)) {
      config.excluded_product_ids = [...config.excluded_product_ids, productId]
    }
  }
  delete config.sig // přepočítat ceny

  await updatePriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          id,
          ...(patch.title ? { title: patch.title } : {}),
          ...(patch.enabled !== undefined ? { status: patch.enabled ? "active" : "draft" } : {}),
          ...(patch.starts_at !== undefined ? { starts_at: patch.starts_at } : {}),
          ...(patch.ends_at !== undefined || config.type === "stock"
            ? { ends_at: config.type === "stock" ? null : patch.ends_at ?? null }
            : {}),
          description: vyprodejDescription(config),
        } as any,
      ],
    },
  })
  await syncVyprodeje(container)
  return (await loadVyprodeje(container)).find((vyprodej) => vyprodej.id === id)!
}

export const deleteVyprodej = async (container: MedusaContainer, id: string) => {
  const current = (await loadVyprodeje(container)).find((vyprodej) => vyprodej.id === id)
  if (!current) return 0
  await deletePriceListsWorkflow(container).run({ input: { ids: [id] } })
  await syncVyprodeje(container)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (current.config.members.length) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: DISCOUNTABLE_PRODUCT_FIELDS,
      filters: { id: current.config.members },
    })
    await applyDiscountableRule(container, products as any[]).catch(() => undefined)
  }
  await revalidateStorefront({
    container,
    event: { name: "vyprodej.deleted", data: { id } },
  } as never)
  return 1
}

/** Výprodej, který výrobek právě zlevňuje (nebo by zlevňoval — vypnutý). */
export const vyprodejForProduct = async (
  container: MedusaContainer,
  productId: string
): Promise<(Vyprodej & { via: VyprodejVia | null }) | null> => {
  const all = await loadVyprodeje(container)
  const vyprodej =
    all.find((item) => (item.state === "running" || item.state === "scheduled") && item.config.members.includes(productId)) ??
    all.find((item) => item.state === "off" && item.config.members.includes(productId)) ??
    null
  if (!vyprodej) return null
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: products }, { data: categories }] = await Promise.all([
    query.graph({
      entity: "product",
      fields: ["id", "collection_id", "categories.id"],
      filters: { id: productId },
    }),
    query.graph({
      entity: "product_category",
      fields: ["id", "parent_category_id", "metadata"],
      pagination: { take: 1000, skip: 0 },
    }),
  ])
  const product = (products as any[])[0]
  const categoryMap = new Map<string, CategoryInfo>(
    (categories as any[]).map((category) => [
      category.id,
      {
        parent_id: category.parent_category_id ?? null,
        collection_id: (category.metadata ?? {}).collection_id ?? null,
      },
    ])
  )
  const via = product
    ? vyprodejVia(
        {
          id: product.id,
          collection_id: product.collection_id ?? null,
          category_ids: (product.categories ?? []).map((category: any) => category.id),
          variants: [],
        },
        vyprodej.config,
        categoryMap
      )
    : null
  return { ...vyprodej, via }
}

/** Pro seznam ve Slevách: výrobky výprodeje s názvem a fotkou. */
export const vyprodejMembersPreview = async (
  container: MedusaContainer,
  productIds: string[]
) => {
  if (!productIds.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail"],
    filters: { id: productIds },
  })
  return (data as any[]).map((product) => ({
    id: product.id,
    title: product.title,
    thumbnail: product.thumbnail ?? null,
  }))
}

/** Náhled pro průvodce: kolik výrobků by výprodej vzal (bez zápisu). */
export const previewVyprodej = async (
  container: MedusaContainer,
  input: Pick<VyprodejInput, "type" | "collection_ids" | "category_ids" | "product_ids"> & {
    ignore_id?: string
  }
) => {
  const [catalog, vyprodeje] = await Promise.all([loadCatalog(container), loadVyprodeje(container)])
  const taken = new Set<string>(
    vyprodeje
      .filter((item) => (item.state === "running" || item.state === "scheduled") && item.id !== input.ignore_id)
      .flatMap((item) => item.config.members)
  )
  const resolved = resolveVyprodejMembers(
    catalog.products,
    {
      type: input.type,
      percent: 1,
      collection_ids: input.collection_ids,
      category_ids: input.category_ids,
      product_ids: input.product_ids,
      excluded_product_ids: [],
      members: [],
    },
    { categories: catalog.categories, available: catalog.available, takenByOther: taken }
  )
  const byId = new Map(catalog.products.map((product) => [product.id, product]))
  return {
    count: resolved.productIds.length,
    products: resolved.productIds.slice(0, 8).map((id) => ({
      id,
      title: byId.get(id)?.title ?? id,
      thumbnail: byId.get(id)?.thumbnail ?? null,
    })),
    skipped: resolved.skipped,
  }
}
