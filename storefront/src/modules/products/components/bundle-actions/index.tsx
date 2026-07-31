"use client"

import { addBundleToCart } from "@lib/data/cart"
import { BundleProduct } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import CartButton from "@modules/products/ProductPage/product/details/Cta/Add/button/cart-button"
import Colors from "@modules/products/ProductPage/product/details/Options/Colors"
import Sizes from "@modules/products/ProductPage/product/details/Options/Sizes"
import Thumbnail from "@modules/products/components/thumbnail"
import WishlistToggle from "@modules/products/components/wishlist-toggle"
import { AnimatePresence, motion } from "framer-motion"
import { isEqual } from "lodash"
import { useParams } from "next/navigation"
import { ReactNode, useEffect, useMemo, useState } from "react"

type BundleActionsProps = {
  bundle: BundleProduct
  wishlistItems?: any[]
  onWishlistUpdateAction?: () => Promise<void>
  isAuthenticated?: boolean
  region?: HttpTypes.StoreRegion
  isPreview?: boolean
  price?: ReactNode
  wishlistVariantId?: string
}

const ease = [0.22, 1, 0.36, 1] as const

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"] | undefined
) =>
  variantOptions?.reduce((options: Record<string, string>, option: any) => {
    options[option.option_id] = option.value
    return options
  }, {}) ?? {}

const getInitialOptions = (bundle: BundleProduct) =>
  bundle.items.reduce<Record<string, Record<string, string>>>((all, item) => {
    all[item.product.id] = optionsAsKeymap(item.product.variants?.[0]?.options)
    return all
  }, {})

export default function BundleActions({
  bundle,
  wishlistItems,
  onWishlistUpdateAction,
  isAuthenticated,
  region,
  isPreview = false,
  price,
  wishlistVariantId,
}: BundleActionsProps) {
  const [productOptions, setProductOptions] = useState(() =>
    getInitialOptions(bundle)
  )
  const [isAdding, setIsAdding] = useState(false)
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const countryCode = useParams().countryCode as string

  useEffect(() => {
    setProductOptions(getInitialOptions(bundle))
    setActiveItemIndex(0)
  }, [bundle])

  const selectedVariants = useMemo(
    () =>
      bundle.items.map((item) =>
        item.product.variants?.find((variant) =>
          isEqual(
            optionsAsKeymap(variant.options),
            productOptions[item.product.id]
          )
        )
      ),
    [bundle.items, productOptions]
  )

  const allVariantsSelected = selectedVariants.every(Boolean)
  const activeItem = bundle.items[activeItemIndex]
  const activeOptions = activeItem
    ? productOptions[activeItem.product.id] ?? {}
    : {}

  const setOptionValue = (
    productId: string,
    optionId: string,
    value: string
  ) => {
    setProductOptions((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [optionId]: value,
      },
    }))
  }

  const handleAddToCart = async () => {
    if (isPreview || !allVariantsSelected || isAdding) return

    setIsAdding(true)
    try {
      await addBundleToCart({
        bundleId: bundle.id,
        quantity: 1,
        countryCode,
        items: bundle.items.map((item, index) => ({
          item_id: item.id,
          variant_id: selectedVariants[index]?.id ?? "",
        })),
      })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="bundleInline">
      <div className="bundleInline__heading">
        <span>Objekty v souboru</span>
        <span>{String(bundle.items.length).padStart(2, "0")}</span>
      </div>

      <div
        className="bundleInline__previews"
        role="tablist"
        aria-label="Objekty v souboru"
      >
        {bundle.items.map((item, index) => {
          const isActive = activeItemIndex === index

          return (
            <motion.button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className="bundleInline__preview"
              data-active={isActive}
              onClick={() => setActiveItemIndex(index)}
              initial={false}
              animate={isActive ? "active" : "idle"}
              whileHover="hover"
              whileTap={{ scale: 0.985 }}
              variants={{
                idle: { opacity: 0.62, y: 0 },
                hover: { opacity: 1, y: -2 },
                active: { opacity: 1, y: -2 },
              }}
              transition={{ duration: 0.48, ease }}
            >
              <span className="bundleInline__previewMedia">
                <Thumbnail
                  thumbnail={item.product.thumbnail}
                  images={item.product.images}
                  size="square"
                  className="bundleInline__previewImage"
                />
                {isActive && (
                  <motion.i
                    className="bundleInline__previewFrame"
                    layoutId="bundle-active-object"
                    transition={{ duration: 0.55, ease }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.product.title}</strong>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {activeItem && region && (
          <motion.div
            className="bundleInline__configuration"
            key={activeItem.id}
            initial={{ opacity: 0, y: 14, clipPath: "inset(0 0 20% 0)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
            exit={{ opacity: 0, y: -8, clipPath: "inset(100% 0 0 0)" }}
            transition={{ duration: 0.52, ease }}
          >
            <div className="bundleInline__activeTitle">
              <small>Upravujete</small>
              <span>{activeItem.product.title}</span>
            </div>
            <Colors
              product={activeItem.product}
              region={region}
              isAdding={isAdding}
              options={activeOptions}
              setOptionValue={(optionId, value) =>
                setOptionValue(activeItem.product.id, optionId, value)
              }
            />
            <Sizes
              product={activeItem.product}
              region={region}
              isAdding={isAdding}
              options={activeOptions}
              setOptionValue={(optionId, value) =>
                setOptionValue(activeItem.product.id, optionId, value)
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bundleInline__purchase">
        {price}
        <div className="bundleInline__actions">
          <div className="product__details__cta__buy__button__add">
            <WishlistToggle
              variantId={wishlistVariantId}
              wishlistItems={wishlistItems}
              onWishlistUpdateAction={onWishlistUpdateAction}
              isAuthenticated={isAuthenticated}
            />
          </div>
          <CartButton
            onClick={handleAddToCart}
            disabled={isPreview || !allVariantsSelected || isAdding}
            isLoading={isAdding}
            className="bundleInline__cart"
            data-testid="add-bundle-button"
          >
            {isPreview
              ? "Náhled souboru"
              : !allVariantsSelected
              ? "Dokončete provedení"
              : "Přidat soubor do košíku"}
          </CartButton>
        </div>
        <p>
          {isPreview
            ? "Ukázkové provedení · nákup bude dostupný po napojení dat."
            : "Všechny vybrané objekty přidáme do košíku společně."}
        </p>
      </div>
    </div>
  )
}
