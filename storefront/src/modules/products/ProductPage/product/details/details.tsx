"use client"

import { addToCart } from "@lib/data/cart"
import { BundleProduct } from "@lib/data/products"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { HttpTypes } from "@medusajs/types"
import Details from "@modules/products/ProductPage/details"
import RestockForm from "@modules/products/ProductPage/restock"
import BundleActions from "@modules/products/components/bundle-actions"
import { isEqual } from "lodash"
import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import Gallery from "../Gallery/gallery"
import CTA from "./Cta/Add"
import ProductPrice from "./Cta/Price"
import Colors from "./Options/Colors"
import Sizes from "./Options/Sizes"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  categories?: HttpTypes.StoreProductCategory[]
  wishlistItems?: any[]
  isAuthenticated?: boolean
  initialRating?: number
  initialCount?: number
  bundle?: BundleProduct
  isBundlePreview?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) =>
  variantOptions?.reduce((acc: Record<string, string>, option: any) => {
    acc[option.option_id] = option.value
    return acc
  }, {}) ?? {}

const ProductDetails: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  categories,
  wishlistItems,
  isAuthenticated,
  initialRating = 0,
  initialCount = 0,
  bundle,
  isBundlePreview = false,
}) => {
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    const firstVariant = product.variants?.[0]
    if (firstVariant) setOptions(optionsAsKeymap(firstVariant.options))
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    return product.variants?.find((variant) =>
      isEqual(optionsAsKeymap(variant.options), options)
    )
  }, [product.variants, options])

  const isValidVariant = useMemo(
    () =>
      !!product.variants?.some((variant) =>
        isEqual(optionsAsKeymap(variant.options), options)
      ),
    [product.variants, options]
  )

  const inStock = useMemo(() => {
    if (!selectedVariant) return false
    if (!selectedVariant.manage_inventory || selectedVariant.allow_backorder) {
      return true
    }
    return (selectedVariant.inventory_quantity || 0) > 0
  }, [selectedVariant])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((previous) => ({ ...previous, [optionId]: value }))
  }

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return
    setIsAdding(true)
    try {
      const result = await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        countryCode,
      })
      if (!result?.success)
        console.error("Failed to add to cart:", result?.message)
    } catch (error: any) {
      console.error("Failed to add to cart:", error?.message || error)
    } finally {
      setIsAdding(false)
    }
  }

  const category = categories
    ?.map((item) => item.name || item.handle)
    .filter(Boolean)
    .join(" · ")

  const description =
    product.description?.trim() ||
    "Ručně vytvořený keramický objekt z píseckého ateliéru."
  const descriptionWords = description.split(/\s+/).filter(Boolean)
  const hasLongDescription = descriptionWords.length > 25
  const descriptionPreview = hasLongDescription
    ? descriptionWords.slice(0, 25).join(" ")
    : description
  const selectedOptionLabels = product.options
    ?.map((option) => options[option.id])
    .filter(Boolean)
    .join(" · ")
  const displayTitle = bundle?.title || product.title
  const openDescription = () => {
    window.dispatchEvent(new CustomEvent("open-product-details-desc"))
    const details = document.getElementById("product-details")
    if (details) scrollWithLenis(details)
  }
  const scrollToReviews = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const reviews = document.getElementById("product-reviews")
    if (reviews) {
      scrollWithLenis(reviews)
      window.history.replaceState(null, "", "#product-reviews")
    }
  }

  return (
    <>
      <div className="product__story">
        <aside className="product__identity" aria-label="Informace o produktu">
          <motion.div
            className="product__identityInner"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="product__eyebrow">
              <span>01 · {category || "Autorská keramika"}</span>
              <span>Písek</span>
            </div>

            <h1>{displayTitle}</h1>
            <p className="product__signature">
              {bundle
                ? "Objekty vybrané společně."
                : "Originál vytvořený rukama."}
            </p>
            <p className="product__lead">
              {descriptionPreview}
              {hasLongDescription && (
                <>
                  {"… "}
                  <button
                    type="button"
                    className="product__leadMore"
                    onClick={openDescription}
                  >
                    více
                  </button>
                </>
              )}
            </p>

            {initialCount >= 5 && (
              <div
                className="product__rating"
                aria-label={`${initialRating} z 5, ${initialCount} recenzí`}
              >
                <span className="product__ratingValue">
                  {initialRating.toFixed(1)}
                </span>
                <span className="product__ratingRule" />
                <a href="#product-reviews" onClick={scrollToReviews}>
                  {initialCount} recenzí
                </a>
              </div>
            )}

            <div className="product__detailsSlot">
              <Details product={product} />
            </div>
          </motion.div>
        </aside>

        <div className="product__media" aria-label="Fotografie produktu">
          <Gallery
            product={product}
            region={region}
            countryCode={countryCode}
            bundle={bundle}
          />
        </div>

        <aside
          className="product__purchase"
          data-bundle={bundle ? "true" : undefined}
          aria-label="Výběr varianty a nákup"
        >
          <motion.div
            className="product__purchaseInner"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="product__purchaseHeader">
              <span>Volba objektu</span>
              <span>{inStock ? "K dispozici" : "Na dotaz"}</span>
            </div>

            <div className="product__selection">
              <small>Vaše provedení</small>
              <span>
                {bundle
                  ? `${bundle.items.length} objekty · jeden celek`
                  : selectedOptionLabels ||
                    selectedVariant?.title ||
                    "Originální provedení"}
              </span>
            </div>

            {bundle ? (
              <BundleActions
                bundle={bundle}
                region={region}
                isPreview={isBundlePreview}
                wishlistVariantId={selectedVariant?.id}
                wishlistItems={wishlistItems}
                isAuthenticated={isAuthenticated}
                price={
                  <ProductPrice
                    product={product}
                    variant={selectedVariant}
                    countryCode={countryCode}
                  />
                }
              />
            ) : (
              <>
                <div className="product__optionPanel">
                  <Colors
                    product={product}
                    region={region}
                    isAdding={isAdding}
                    options={options}
                    setOptionValue={setOptionValue}
                  />
                  <Sizes
                    product={product}
                    region={region}
                    isAdding={isAdding}
                    options={options}
                    setOptionValue={setOptionValue}
                  />
                </div>

                <div className="product__buyBlock">
                  <ProductPrice
                    product={product}
                    variant={selectedVariant}
                    countryCode={countryCode}
                  />
                  <CTA
                    inStock={inStock}
                    selectedVariant={selectedVariant}
                    isAdding={isAdding}
                    isValidVariant={isValidVariant}
                    handleAddToCart={handleAddToCart}
                    options={options}
                    product={product}
                    wishlistItems={wishlistItems}
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              </>
            )}

            <div className="product__serviceNotes">
              <span>Bezpečně baleno</span>
              <span>Ručně vytvořeno</span>
              <span>Ateliér · Písek</span>
            </div>

            {!bundle && selectedVariant && !inStock && (
              <RestockForm
                variant={{
                  id: selectedVariant.id,
                  title: selectedVariant.title || undefined,
                }}
                product={{ title: product.title || undefined }}
              />
            )}
          </motion.div>
        </aside>
      </div>
    </>
  )
}

export default ProductDetails
