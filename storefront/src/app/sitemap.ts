import type { MetadataRoute } from "next"

/**
 * sitemap.xml — dřív tuhle cestu spolkla dynamická routa [countryCode]
 * a vracela HTML. Statické stránky + živý katalog (produkty, kategorie,
 * kolekce) z Medusy; když backend zrovna neodpoví, vrátí se aspoň statická
 * část — rozbitá sitemap nesmí shodit indexaci celého webu.
 */

const REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "cz"

const STATIC_PATHS = [
  "",
  "/store",
  "/kurzy",
  "/o-mne",
  "/vyroba",
  "/dotazy",
  "/doprava-a-platba",
  "/smluvni-podminky",
  "/ochrana-osobnich-udaju",
  "/reklamacni-protokol",
  "/odstoupeni-od-smlouvy",
  "/cookies",
]

type HandleRow = { handle: string | null; updated_at?: string | null }

const backendBase = () =>
  (process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "").replace(/\/$/, "")

async function fetchHandles(path: string, key: string): Promise<HandleRow[]> {
  const base = backendBase()
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  if (!base || !publishableKey) {
    return []
  }
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "x-publishable-api-key": publishableKey },
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return []
    }
    const body = (await res.json()) as Record<string, HandleRow[]>
    return body[key] ?? []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://store.matejforejt.com").replace(/\/$/, "")
  const prefix = `${base}/${REGION}`
  const now = new Date()

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${prefix}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/store" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/store" ? 0.9 : 0.5,
  }))

  const [products, categories, collections] = await Promise.all([
    fetchHandles("/store/products?limit=1000&fields=handle,updated_at&status[]=published", "products"),
    fetchHandles("/store/product-categories?limit=100&fields=handle", "product_categories"),
    fetchHandles("/store/collections?limit=100&fields=handle", "collections"),
  ])

  for (const product of products) {
    if (!product.handle) continue
    entries.push({
      url: `${prefix}/products/${product.handle}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    })
  }
  for (const category of categories) {
    if (!category.handle) continue
    entries.push({
      url: `${prefix}/categories/${category.handle}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    })
  }
  for (const collection of collections) {
    if (!collection.handle) continue
    entries.push({
      url: `${prefix}/collections/${collection.handle}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    })
  }

  return entries
}
