"use server"

import { sdk } from "@lib/config"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { listCategories } from "./categories"
import { listCollections } from "./collections"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"
import { StoreProductReview } from "../../types/global"
import { toCzechErrorMessage } from "@lib/util/error-messages"

export type BundleProduct = {
  id: string
  title: string
  product: {
    id: string
    thumbnail: string
    title: string
    handle: string
  }
  items: {
    id: string
    title: string
    product: HttpTypes.StoreProduct
  }[]
}

type StoreProductListQuery = HttpTypes.FindParams &
  HttpTypes.StoreProductListParams

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: StoreProductListQuery
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: (HttpTypes.StoreProduct & {
    bundle?: Omit<BundleProduct, "items">
  })[]; count: number }
  nextPage: number | null
  queryParams?: StoreProductListQuery
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 16
  const _pageParam = Math.max(pageParam, 1)
  const offset = (_pageParam === 1) ? 0 : (_pageParam - 1) * limit;

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }
  
  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: (HttpTypes.StoreProduct & { bundle?: Omit<BundleProduct, "items"> })[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

export type StoreCatalogueFilters = {
  categoryId: string
  collectionId: string
  isNew: boolean
  onSale: boolean
  priceRange: string
  search: string
  sort: "featured" | "newest" | "price-asc" | "price-desc"
}

/**
 * Price range comes as a string so it can live in a URL: `"min-max"` for a
 * bounded range, `"min+"` for no upper limit, `""` for no filter. Used to be a
 * four-entry lookup of preset pills; the filter panel now sends arbitrary
 * ranges from its slider/inputs, and the old preset strings still parse the
 * same.
 */
const parseCataloguePriceRange = (
  value: string
): { min: number; max: number } | null => {
  if (!value) return null
  const open = value.match(/^(\d+)\+$/)
  if (open) return { min: Number(open[1]), max: Number.POSITIVE_INFINITY }
  const pair = value.match(/^(\d+)-(\d+)$/)
  if (pair) return { min: Number(pair[1]), max: Number(pair[2]) }
  return null
}

/** Diacritics-insensitive lowercase, so „kvetinace" and „Květináče" meet in the middle. */
const foldSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs")

/** Words shorter than this carry no signal on their own („na", „do", „a"). */
const SEARCH_TOKEN_MIN = 3

const tokenizeSearchText = (value: string) =>
  foldSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= SEARCH_TOKEN_MIN)

const commonPrefixLength = (first: string, second: string) => {
  let index = 0
  while (
    index < first.length &&
    index < second.length &&
    first[index] === second[index]
  ) {
    index += 1
  }
  return index
}

/** Classic two-row Levenshtein; tokens are single short words, so this stays cheap. */
const editDistance = (first: string, second: string) => {
  let previous = Array.from({ length: second.length + 1 }, (_, i) => i)

  for (let i = 1; i <= first.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= second.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }

  return previous[second.length]
}

/**
 * Whether two folded word tokens mean the same word to a customer. Czech
 * inflection moves the END of a word („kytky" / „kytičky", „hrnek" / „hrnky"),
 * so a shared beginning or a small edit budget is the signal — an exact-only
 * match sent „Kytky" home with nothing.
 */
const searchTokensAlike = (first: string, second: string) => {
  if (first === second) return true
  if (first.startsWith(second) || second.startsWith(first)) return true
  if (commonPrefixLength(first, second) >= 4) return true

  // Inflection never touches the first letter — without this guard the edit
  // budget bridged unrelated words („plastika" → „klasika").
  if (first[0] !== second[0]) return false

  const shorter = Math.min(first.length, second.length)
  const budget = shorter >= 5 ? 2 : shorter === 4 ? 1 : 0
  return budget > 0 && editDistance(first, second) <= budget
}

/**
 * Medusa's `q` searches product text and knows nothing about the shop's own
 * taxonomy — typing a category's name („Kytky") found nothing unless the word
 * also appeared in a product. So the term is matched here against category and
 * collection names too, and their products join the results after the direct
 * text hits. Matching is diacritics-insensitive and works in both directions
 * (term inside name, name inside term), entries hidden by the admin eye stay
 * out, and an axis the customer has explicitly filtered is never expanded —
 * search must not smuggle other categories into a pinned category view.
 */
const matchCatalogueTaxonomy = async (
  term: string,
  filters: StoreCatalogueFilters
): Promise<{ categoryIds: string[]; collectionIds: string[] }> => {
  const folded = foldSearchText(term)
  if (!folded) return { categoryIds: [], collectionIds: [] }

  const [categories, collectionResult] = await Promise.all([
    listCategories({ limit: 100, fields: "id,name,metadata" }).catch(
      () => [] as HttpTypes.StoreProductCategory[]
    ),
    listCollections({ fields: "id,title,metadata" }).catch(() => ({
      collections: [] as HttpTypes.StoreCollection[],
      count: 0,
    })),
  ])

  const termTokens = tokenizeSearchText(term)
  const matchesName = (name: string | null | undefined) => {
    const foldedName = foldSearchText(name ?? "")
    if (!foldedName) return false
    // Whole-phrase containment first („na drátě"), then word-by-word with
    // inflection tolerance — „Kytky" has to reach „Kytičky na drátě".
    if (
      foldedName.includes(folded) ||
      (foldedName.length >= 3 && folded.includes(foldedName))
    ) {
      return true
    }
    const nameTokens = tokenizeSearchText(foldedName)
    return termTokens.some((termToken) =>
      nameTokens.some((nameToken) => searchTokensAlike(termToken, nameToken))
    )
  }
  const isHidden = (metadata: unknown) =>
    Boolean((metadata as Record<string, unknown> | null)?.hidden)

  return {
    categoryIds: filters.categoryId
      ? []
      : categories
          .filter(
            (category) =>
              !isHidden(category.metadata) && matchesName(category.name)
          )
          .map((category) => category.id),
    collectionIds: filters.collectionId
      ? []
      : collectionResult.collections
          .filter(
            (collection) =>
              !isHidden(collection.metadata) && matchesName(collection.title)
          )
          .map((collection) => collection.id),
  }
}

/**
 * Store catalogue query built on the existing Medusa product data layer.
 *
 * Search, category, recency, ordering, region pricing and pagination are sent
 * to Medusa. Price and sale filters use the returned regional calculated
 * prices, so those refinements are resolved here on the server.
 */
export const listStoreCatalogue = async ({
  filters,
  limit = 16,
  offset = 0,
  countryCode,
  regionId,
}: {
  filters: StoreCatalogueFilters
  limit?: number
  offset?: number
  countryCode?: string
  regionId?: string
}): Promise<{
  products: HttpTypes.StoreProduct[]
  count: number
}> => {
  const normalizedLimit = Math.min(Math.max(limit, 1), 48)
  const normalizedOffset = Math.max(offset, 0)

  const searchTerm = filters.search.trim()
  const taxonomy = searchTerm
    ? await matchCatalogueTaxonomy(searchTerm, filters)
    : { categoryIds: [], collectionIds: [] }
  const searchAcrossTaxonomy =
    taxonomy.categoryIds.length > 0 || taxonomy.collectionIds.length > 0

  const needsCalculatedPriceRefinement = Boolean(
    filters.priceRange ||
    filters.onSale ||
    filters.sort === "price-asc" ||
    filters.sort === "price-desc"
  )
  // Both taxonomy-widened search and price work need the whole result set here
  // before it can be filtered, ordered and paged locally.
  const needsLocalAssembly = needsCalculatedPriceRefinement || searchAcrossTaxonomy

  const queryParams: StoreProductListQuery = {
    limit: needsLocalAssembly ? 100 : normalizedLimit,
    // `inventory_quantity` is a computed field Medusa only returns when it is
    // asked for by name. Without it every tracked variant read as quantity 0,
    // so the grid called in-stock pieces „Prodáno" and never showed „Poslední
    // kus" at all — the cards contradicted the product page they linked to.
    fields: "*bundle,*type,*categories,*images,+variants.inventory_quantity",
  }

  if (searchTerm) {
    queryParams.q = searchTerm
  }

  if (filters.categoryId) {
    queryParams.category_id = [filters.categoryId]
  }

  if (filters.collectionId) {
    queryParams.collection_id = [filters.collectionId]
  }

  if (filters.isNew) {
    queryParams.created_at = {
      $gte: new Date(Date.now() - 30 * 86400000).toISOString(),
    }
  }

  if (filters.sort === "newest") {
    queryParams.order = "-created_at"
  }

  if (!needsLocalAssembly) {
    const {
      response: { products, count },
    } = await listProducts({
      pageParam: Math.floor(normalizedOffset / normalizedLimit) + 1,
      queryParams,
      countryCode,
      regionId,
    })

    return { products, count }
  }

  const fetchAllPages = async (pageQuery: StoreProductListQuery) => {
    const firstPage = await listProducts({
      pageParam: 1,
      queryParams: pageQuery,
      countryCode,
      regionId,
    })
    const gathered = [...firstPage.response.products]
    const pageCount = Math.ceil(firstPage.response.count / pageQuery.limit!)

    for (let page = 2; page <= pageCount; page += 1) {
      const {
        response: { products },
      } = await listProducts({
        pageParam: page,
        queryParams: pageQuery,
        countryCode,
        regionId,
      })

      gathered.push(...products)
    }

    return gathered
  }

  const catalogueProducts = await fetchAllPages(queryParams)

  if (searchAcrossTaxonomy) {
    // Products of the matched categories/collections join AFTER the direct text
    // hits, so plain matches keep the front of the list. The other explicit
    // filters ride along in the sub-queries untouched.
    const taxonomyQuery = { ...queryParams }
    delete taxonomyQuery.q

    if (taxonomy.categoryIds.length > 0) {
      catalogueProducts.push(
        ...(await fetchAllPages({
          ...taxonomyQuery,
          category_id: taxonomy.categoryIds,
        }))
      )
    }
    if (taxonomy.collectionIds.length > 0) {
      catalogueProducts.push(
        ...(await fetchAllPages({
          ...taxonomyQuery,
          collection_id: taxonomy.collectionIds,
        }))
      )
    }
  }

  const seenIds = new Set<string>()
  const uniqueProducts = catalogueProducts.filter((product) => {
    if (seenIds.has(product.id)) return false
    seenIds.add(product.id)
    return true
  })

  const priceRange = parseCataloguePriceRange(filters.priceRange)
  const refinedProducts = uniqueProducts.filter((product) => {
    const { cheapestPrice } = getProductPrice({ product })
    const price = cheapestPrice?.calculated_price_number

    if (
      priceRange &&
      (typeof price !== "number" ||
        price < priceRange.min ||
        price > priceRange.max)
    ) {
      return false
    }

    if (filters.onSale && cheapestPrice?.price_type !== "sale") {
      return false
    }

    return true
  })

  if (filters.sort === "price-asc" || filters.sort === "price-desc") {
    refinedProducts.sort((firstProduct, secondProduct) => {
      const firstPrice = getProductPrice({
        product: firstProduct,
      }).cheapestPrice?.calculated_price_number
      const secondPrice = getProductPrice({
        product: secondProduct,
      }).cheapestPrice?.calculated_price_number

      if (typeof firstPrice !== "number") {
        return typeof secondPrice === "number" ? 1 : 0
      }

      if (typeof secondPrice !== "number") {
        return -1
      }

      return filters.sort === "price-asc"
        ? firstPrice - secondPrice
        : secondPrice - firstPrice
    })
  }

  if (filters.sort === "newest" && searchAcrossTaxonomy) {
    // Each sub-query came back ordered, but the merge interleaved them.
    refinedProducts.sort(
      (first, second) =>
        new Date(second.created_at ?? 0).getTime() -
        new Date(first.created_at ?? 0).getTime()
    )
  }

  return {
    products: refinedProducts.slice(
      normalizedOffset,
      normalizedOffset + normalizedLimit
    ),
    count: refinedProducts.length,
  }
}


/**
 * This will fetch reviews for a specific product.
 * It will return the reviews along with the average rating, limit, offset, and count. So they can be used for pagination. and for displaying the average rating.
 */

export const getProductReviews = async ({
  productId,
  limit = 10,
  offset = 0,
}: {
  productId: string
  limit?: number
  offset?: number 
}) => {
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  const headers = {
    ...(await getAuthHeaders()),
    ...(pk ? { "x-publishable-api-key": pk, "x-publishable-key": pk } : {}),
  }

  const next = {
    ...(await getCacheOptions(`product-reviews-${productId}`)),
  }
  
  const url = `/store/products/${productId}/reviews`
  const query = { limit, offset, order: "-created_at" }

  console.log("=== getProductReviews REQUEST ===")
  console.log("URL:", url)
  console.log("Query:", query)
  console.log("Headers:", headers)
  console.log("Next options:", next)
  return sdk.client.fetch<{
    reviews: StoreProductReview[]
    average_rating: number
    limit: number
    offset: number
    count: number
  }>(`/store/products/${productId}/reviews`, {
    // NOTE: always check for the method, dot forget it. 
    // WIP: LET THE DEVS KNOW THERE IS ISSUE WITH THEIR DOCS CODE 
  
    method: "GET",
    headers,
    query: {
      limit,
      offset,
      order: "-created_at",
    },
    next,
    cache: "force-cache",
  })
}

export const addProductReview = async (input: {
  title?: string
  content: string
  first_name: string
  last_name: string
  rating: number,
  product_id: string
}) => {
  // Call local API route to avoid server action context issues
  const res = await fetch(`/api/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(toCzechErrorMessage(data?.message))
  }

  return res.json()
}


export const subscribeToRestock = async ({
  variant_id,
  email,
  sales_channel_id,
}: {
  variant_id: string
  email?: string
  sales_channel_id?: string
}) => {
  return sdk.client.fetch(`/store/restock-subscriptions`, {
    method: "POST",
    body: {
      variant_id,
      email,
      sales_channel_id,
    },
    cache: "no-store",
  })
}


export const getBundleProduct = async (id: string, {
  currency_code,
  region_id,
}: {
  currency_code?: string
  region_id?: string
}) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<{
    bundle_product: BundleProduct
  }>(`/store/bundle-products/${id}`, {
    method: "GET",
    headers,
    query: {
      currency_code,
      region_id,
    },
  })
}


export const listBundles = async (params?: { limit?: number; offset?: number }) => {
  return sdk.client.fetch<{ bundles: BundleProduct[]; count: number }>(
    "/store/bundle-products",
    {
      method: "GET",
      query: params,
    }
  )
}

export const getCustomVariantPrice = async ({
  variant_id,
  region_id,
  metadata,
}: {
  variant_id: string
  region_id: string
  metadata?: Record<string, any>
}) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ price: number }>(
      `/store/variants/${variant_id}/price`,
      {
        method: "POST",
        body: {
          region_id,
          metadata,
        },
        headers,
        cache: "no-cache",
      }
    )
    .then(({ price }) => price)
}

export const retrieveProduct = async (
  id: string,
  query?: HttpTypes.StoreProductParams & HttpTypes.FindParams
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions(`product-${id}`)),
  }

  return sdk.client
    .fetch<{ product: HttpTypes.StoreProduct }>(`/store/products/${id}`, {
      method: "GET",
      headers,
      query,
      next,
      cache: "force-cache",
    })
    .then(({ product }) => product)
}
