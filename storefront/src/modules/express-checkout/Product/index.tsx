"use client"

import {
  selectExpressBundle,
  selectExpressVariant,
} from "@lib/data/express-cart"
import { BundleProduct } from "@lib/data/products"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import styles from "../style.module.scss"

const optionsAsKeymap = (
  options: HttpTypes.StoreProductVariant["options"] | undefined
) =>
  options?.reduce((result: Record<string, string>, option: any) => {
    result[option.option_id] = option.value
    return result
  }, {}) ?? {}

const findVariant = (
  product: HttpTypes.StoreProduct,
  selection: Record<string, string>
) =>
  product.variants?.find((variant) => {
    const candidate = optionsAsKeymap(variant.options)
    return (
      Object.keys(candidate).length === Object.keys(selection).length &&
      Object.entries(candidate).every(([key, value]) => selection[key] === value)
    )
  })

const isAvailable = (variant?: HttpTypes.StoreProductVariant) =>
  !!variant &&
  (!variant.manage_inventory ||
    variant.allow_backorder ||
    (variant.inventory_quantity || 0) > 0)

type ProductProps = {
  product: HttpTypes.StoreProduct
  bundle?: BundleProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  onContinueAction: () => void
}

export const Product = ({
  product,
  bundle,
  region,
  countryCode,
  onContinueAction,
}: ProductProps) => {
  const [quantity, setQuantity] = useState(1)
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [bundleSelections, setBundleSelections] = useState<
    Record<string, Record<string, string>>
  >({})
  const [activeBundleItem, setActiveBundleItem] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const first = product.variants?.[0]
    if (first) setSelection(optionsAsKeymap(first.options))
  }, [product])

  useEffect(() => {
    if (!bundle) return
    const initial = bundle.items.reduce(
      (result, item) => {
        result[item.product.id] = optionsAsKeymap(
          item.product.variants?.[0]?.options
        )
        return result
      },
      {} as Record<string, Record<string, string>>
    )
    setBundleSelections(initial)
  }, [bundle])

  const selectedVariant = useMemo(
    () => findVariant(product, selection),
    [product, selection]
  )

  const selectedBundleVariants = useMemo(
    () =>
      bundle?.items.map((item) =>
        findVariant(item.product, bundleSelections[item.product.id] || {})
      ) || [],
    [bundle, bundleSelections]
  )

  const ready = bundle
    ? selectedBundleVariants.length === bundle.items.length &&
      selectedBundleVariants.every(isAvailable)
    : isAvailable(selectedVariant)

  const amount =
    selectedVariant?.calculated_price?.calculated_amount ??
    product.variants?.[0]?.calculated_price?.calculated_amount ??
    0

  const submit = async () => {
    if (!ready || isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    const result = bundle
      ? await selectExpressBundle({
          bundleId: bundle.id,
          quantity,
          countryCode,
          items: bundle.items.map((item, index) => ({
            item_id: item.id,
            variant_id: selectedBundleVariants[index]!.id!,
          })),
        })
      : await selectExpressVariant({
          variantId: selectedVariant!.id!,
          quantity,
          countryCode,
        })

    setIsSubmitting(false)
    if (!result.success) {
      setError(result.message || "Výběr se nepodařilo uložit.")
      return
    }
    onContinueAction()
  }

  const activeItem = bundle?.items[activeBundleItem]

  return (
    <div className={styles.productStep}>
      <motion.div
        className={styles.productPortrait}
        initial={{ clipPath: "inset(0 0 100% 0)" }}
        animate={{ clipPath: "inset(0 0 0% 0)" }}
        transition={transition}
      >
        <Image
          src={
            product.thumbnail ||
            product.images?.[0]?.url ||
            "/assets/img/horizontal_prop.png"
          }
          alt={product.title || ""}
          width={620}
          height={760}
          priority
        />
        <span>{bundle ? "Ateliérový soubor" : "Originál z ateliéru"}</span>
      </motion.div>

      <div className={styles.productIdentity}>
        <div>
          <span className={styles.eyebrow}>
            {bundle ? `${bundle.items.length} objekty společně` : "Váš objekt"}
          </span>
          <h2>{bundle?.title || product.title}</h2>
        </div>
        {!bundle && (
          <strong>
            {convertToLocale({
              amount: amount * quantity,
              currency_code: region.currency_code,
            })}
          </strong>
        )}
      </div>

      {bundle ? (
        <div className={styles.bundleConfigurator}>
          <div className={styles.bundleTabs} role="tablist">
            {bundle.items.map((item, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeBundleItem === index}
                data-active={activeBundleItem === index}
                onClick={() => setActiveBundleItem(index)}
                key={item.id}
              >
                <Image
                  src={
                    item.product.thumbnail ||
                    item.product.images?.[0]?.url ||
                    "/assets/img/horizontal_prop.png"
                  }
                  alt=""
                  width={68}
                  height={68}
                />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeItem && (
              <motion.div
                className={styles.bundleItem}
                key={activeItem.id}
                initial={bundleItemInitial}
                animate={animate}
                exit={exit}
                transition={transition2}
              >
                <span className={styles.eyebrow}>Upravujete</span>
                <h3>{activeItem.product.title}</h3>
                <OptionGroups
                  product={activeItem.product}
                  selection={bundleSelections[activeItem.product.id] || {}}
                  onChangeAction={(optionId, value) =>
                    setBundleSelections((previous) => ({
                      ...previous,
                      [activeItem.product.id]: {
                        ...previous[activeItem.product.id],
                        [optionId]: value,
                      },
                    }))
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <OptionGroups
          product={product}
          selection={selection}
          onChangeAction={(optionId, value) =>
            setSelection((previous) => ({ ...previous, [optionId]: value }))
          }
        />
      )}

      <div className={styles.purchaseBar}>
        <div className={styles.quantity} aria-label="Množství">
          <span>Množství</span>
          <div>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              aria-label="Snížit množství"
            >
              −
            </button>
            <output>{quantity}</output>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(9, value + 1))}
              aria-label="Zvýšit množství"
            >
              +
            </button>
          </div>
        </div>
        <PremiumActionButton
          text={
            isSubmitting
              ? "Připravuji výběr"
              : ready
                ? "Pokračovat k doručení"
                : "Zvolte provedení"
          }
          disabled={!ready || isSubmitting}
          onClickAction={submit}
          className={styles.primaryAction}
        />
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            className={styles.error}
            role="alert"
            initial={initial2}
            animate={animate2}
            exit={exit2}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const OptionGroups = ({
  product,
  selection,
  onChangeAction,
}: {
  product: HttpTypes.StoreProduct
  selection: Record<string, string>
  onChangeAction: (optionId: string, value: string) => void
}) => (
  <div className={styles.optionGroups}>
    {product.options?.map((option) => (
      <fieldset key={option.id}>
        <legend>{option.title}</legend>
        <div>
          {option.values?.map((value) => {
            const active = selection[option.id!] === value.value
            return (
              <motion.button
                type="button"
                key={value.id}
                data-active={active}
                aria-pressed={active}
                onClick={() => onChangeAction(option.id!, value.value!)}
                whileTap={whileTap}
              >
                <span aria-hidden="true" />
                {value.value}
              </motion.button>
            )
          })}
        </div>
      </fieldset>
    ))}
  </div>
)


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: .8, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const bundleItemInitial = { opacity: 0, x: 14 }
const animate = { opacity: 1, x: 0 }
const exit = { opacity: 0, x: -10 }
const transition2 = { duration: .35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial2 = { opacity: 0, y: -4 }
const animate2 = { opacity: 1, y: 0 }
const exit2 = { opacity: 0 }
const whileTap = { scale: .97 }
