"use client"

import type { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import { maxPurchasableQuantity } from "@lib/util/availability"
import {
  MAX_ADD_QUANTITY,
  addToDraft,
  setDraftLine,
} from "@lib/util/order-edit-draft"
import Product from "@modules/products/ProductPage/product"
import type { ProductPickMode } from "@modules/products/ProductPage/product/details/details"

import PickBar, { type PickSwapInfo } from "./pick-bar"
import { editPath, pickShopPath } from "./shared"
import s from "./pick.module.scss"

/**
 * Stránka produktu v režimu výběru (mini obchod úpravy objednávky).
 *
 * Přidání: „Přidat k objednávce #N" zapíše akci `add` do návrhu úpravy.
 * Výměna (§3d.10, `swap`): „Vyměnit za tento výrobek" zapíše `swap` toho
 * řádku na vybranou variantu — počet kusů zůstává řádku, stepper tu proto
 * není — a nahradí jakoukoli jinou rozpracovanou změnu téhož řádku.
 *
 * V obou případech návrh (`sessionStorage`, viz `order-edit-draft`) a návrat
 * na stránku úpravy, kde se souhrn přepočítá sám. Skutečného košíku se nic
 * nedotkne: žádné `addToCart`, žádné cookies košíku.
 */
export default function OrderPickProduct({
  orderId,
  token,
  orderNumber,
  swap = null,
  product,
  region,
  countryCode,
  allowedVariantIds,
}: {
  orderId: string
  token: string
  orderNumber: number
  /** Výměna řádku za jiný výrobek; `null` = přidání kusu. */
  swap?: PickSwapInfo | null
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  /** `allowed[product.id]` z katalogu úpravy (u výměny už zúžené serverem). */
  allowedVariantIds: string[]
}) {
  const router = useRouter()

  const pick = useMemo<ProductPickMode>(() => {
    /* Snímek pro zobrazení na stránce úpravy. U produktu s jediným provedením
       je název varianty „Default" apod. — chip by jen mátl. */
    const snapshot = (variant: HttpTypes.StoreProductVariant) => ({
      product_id: product.id,
      handle: product.handle ?? null,
      title: product.title ?? (swap ? "Jiný výrobek" : "Přidaný kus"),
      variant_title:
        (product.variants?.length ?? 0) > 1 ? variant.title ?? null : null,
      thumbnail: product.thumbnail ?? product.images?.[0]?.url ?? null,
      unit_price: variant.calculated_price?.calculated_amount ?? null,
    })
    const backToEdit = () => router.push(`/${countryCode}${editPath(orderId, token)}`)

    if (swap) {
      return {
        label: "Vyměnit za tento výrobek",
        allowedVariantIds,
        maxQuantity: swap.quantity,
        fixedQuantity: swap.quantity,
        note: swap.samePriceOnly
          ? `Vyměníme ${swap.quantity} ks za stejnou cenu.`
          : `Vyměníme ${swap.quantity} ks. Rozdíl ceny uvidíte v souhrnu úpravy.`,
        blockedText: swap.samePriceOnly
          ? "Tohle provedení za váš kus vyměnit nejde — po zabalení jen za stejnou cenu, nebo ho nemáme na počet kusů."
          : "Tohle provedení za váš kus vyměnit nejde — vyberte prosím jiné.",
        onPick: (variant) => {
          const result = setDraftLine(orderId, swap.itemId, {
            type: "swap",
            variant_id: variant.id,
            product: snapshot(variant),
          })
          if (result.ok) backToEdit()
          return result
        },
      }
    }

    return {
      label: `Přidat k objednávce #${orderNumber}`,
      allowedVariantIds,
      maxQuantity: MAX_ADD_QUANTITY,
      onPick: (variant, quantity) => {
        const { product_id, handle, title, variant_title, thumbnail, unit_price } =
          snapshot(variant)
        const result = addToDraft(orderId, {
          variant_id: variant.id,
          quantity,
          product_id,
          handle,
          title,
          variant_title,
          thumbnail,
          unit_price,
          max_quantity: Math.max(
            1,
            Math.min(
              MAX_ADD_QUANTITY,
              maxPurchasableQuantity(variant, MAX_ADD_QUANTITY)
            )
          ),
        })
        if (result.ok) backToEdit()
        return result
      },
    }
  }, [orderId, token, orderNumber, swap, allowedVariantIds, product, countryCode, router])

  return (
    <main>
      <div className={s.productTop}>
        <PickBar
          tone="dark"
          orderNumber={orderNumber}
          swap={swap}
          editHref={editPath(orderId, token)}
          shopHref={pickShopPath(orderId, token, swap?.itemId)}
        />
      </div>
      <Product
        product={product}
        region={region}
        countryCode={countryCode}
        pick={pick}
      />
    </main>
  )
}
