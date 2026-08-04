"use server"

import { sdk } from "@lib/config"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
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

const cataloguePriceRanges: Record<string, { min: number; max: number }> = {
  "0-500": { min: 0, max: 500 },
  "500-1000": { min: 500, max: 1000 },
  "1000-2500": { min: 1000, max: 2500 },
  "2500+": { min: 2500, max: Number.POSITIVE_INFINITY },
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
  const needsCalculatedPriceRefinement = Boolean(
    filters.priceRange ||
    filters.onSale ||
    filters.sort === "price-asc" ||
    filters.sort === "price-desc"
  )

  const queryParams: StoreProductListQuery = {
    limit: needsCalculatedPriceRefinement ? 100 : normalizedLimit,
    fields: "*bundle,*type,*categories,*images",
  }

  if (filters.search.trim()) {
    queryParams.q = filters.search.trim()
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

  if (!needsCalculatedPriceRefinement) {
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

  const firstPage = await listProducts({
    pageParam: 1,
    queryParams,
    countryCode,
    regionId,
  })
  const catalogueProducts = [...firstPage.response.products]
  const pageCount = Math.ceil(firstPage.response.count / queryParams.limit!)

  for (let page = 2; page <= pageCount; page += 1) {
    const {
      response: { products },
    } = await listProducts({
      pageParam: page,
      queryParams,
      countryCode,
      regionId,
    })

    catalogueProducts.push(...products)
  }

  const priceRange = cataloguePriceRanges[filters.priceRange]
  const refinedProducts = catalogueProducts.filter((product) => {
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
