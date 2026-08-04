import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  // BundleProduct, // Re-enable with the static preview block below.
  getBundleProduct,
  getProductReviews,
  listProducts,
} from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import Product from "@modules/products/ProductPage/product"
import ProductChapter from "@modules/products/ProductPage/product/chapter"
import SoldProducts from "@modules/products/ProductPage/Sold"
import { listCategories } from "@lib/data/categories"
import ProductReviews from "@modules/products/components/product-reviews"
import { getCustomerWishlistItems, retrieveCustomer } from "@lib/data/customer"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
}

// Temporary visual preview for responsive bundle work.
// Uncomment together with the previewBundle block below when a static bundle is
// needed without creating one in Medusa.
// const FORCE_BUNDLE_PREVIEW = true

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c: { iso_2?: string }) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })

      return {
        country,
        products: response.products,
      }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  const description = summarize(
    product.subtitle || product.description,
    `${product.title} — ručně tvořený keramický objekt z ateliéru Lucie Polanské.`
  )

  return {
    title: product.title,
    description,
    openGraph: {
      title: `${product.title} | Keramická zahrada`,
      description,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

/** Trims CMS copy to a length search engines actually render, on a word boundary. */
function summarize(text: string | null | undefined, fallback: string) {
  const clean = text?.replace(/\s+/g, " ").trim()

  if (!clean) {
    return fallback
  }

  if (clean.length <= 160) {
    return clean
  }

  return `${clean.slice(0, 157).replace(/\s+\S*$/, "")}…`
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)
  const countryCode = params.countryCode

  //WIP, fiugure out how to associate a variant with the displayed picture, and add there automatic way how to display variants, like size, color and pattern

  if (!region) {
    notFound()
  }

  // Check if user is authenticated
  const customer = await retrieveCustomer()
  const isAuthenticated = !!customer

   // @ts-ignore 
  const pricedProduct = await listProducts({
    countryCode,
    queryParams: { 
      handle: params.handle, 
      fields: "*bundle, *variants.calculated_price, +variants.inventory_quantity, +metadata, +tags",
    },
  }).then(({ response }) => response.products[0])

  // Check before using
  if (!pricedProduct) {
    notFound()
  }

  // Fetch all categories (with products)
  const categories = await listCategories({
    fields: "*category_children, *products, *parent_category, *parent_category.parent_category",
    limit: 10,
  })

  // Find categories this product belongs to
  const productCategories = categories.filter(cat =>
    Array.isArray(cat.products) && cat.products.some(p => p.id === pricedProduct.id)
  )

  const bundleProduct = pricedProduct.bundle ? 
    await getBundleProduct(pricedProduct.bundle.id, {
      currency_code: region?.currency_code,
      region_id: region?.id,
    }) : null


  const reviewsData = await getProductReviews({
    productId: pricedProduct.id,
    limit: 10,
    offset: 0,
  })

  const relatedProducts = await listProducts({
    countryCode,
    queryParams: {
      limit: 8,
      fields: "id,title,handle,thumbnail,*images,*options,*variants,*collection",
      ...(pricedProduct.collection_id
        ? { collection_id: [pricedProduct.collection_id] }
        : {}),
    },
  }).then(({ response }) =>
    response.products.filter((product) => product.id !== pricedProduct.id)
  )

  const realBundle = bundleProduct?.bundle_product

  /*
  const previewBundle: BundleProduct = {
    id: `preview-${pricedProduct.id}`,
    title: "Ateliérový výběr",
    product: {
      id: pricedProduct.id,
      thumbnail: pricedProduct.thumbnail || "",
      title: pricedProduct.title,
      handle: pricedProduct.handle || "",
    },
    items: [pricedProduct, ...relatedProducts].slice(0, 3).map((product) => ({
      id: `preview-item-${product.id}`,
      title: product.title,
      product,
    })),
  }

  const displayedBundle =
    realBundle || (FORCE_BUNDLE_PREVIEW ? previewBundle : undefined)
  const isBundlePreview = !realBundle && FORCE_BUNDLE_PREVIEW
  */

  // Production path: only bundles returned by Medusa are displayed.
  const displayedBundle = realBundle
  const isBundlePreview = false

  // Fetch customer wishlist items
  const wishlistItems = await getCustomerWishlistItems()

  return (
    <main>
      <Product
        product={pricedProduct}
        region={region}
        countryCode={countryCode}
        bundle={displayedBundle}
        isBundlePreview={isBundlePreview}
        categories={productCategories}
        wishlistItems={wishlistItems}
        isAuthenticated={isAuthenticated}
        initialRating={reviewsData.average_rating}
        initialCount={reviewsData.count}
      />
      <ProductChapter />
      <ProductReviews productId={pricedProduct.id} initialReviews={reviewsData.reviews} initialRating={reviewsData.average_rating} initialCount={reviewsData.count} />
      <SoldProducts products={relatedProducts} />
    </main>
  )
}
