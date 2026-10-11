"use client"

import type { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import { maxPurchasableQuantity } from "@lib/util/availability"
import { MAX_ADD_QUANTITY, addToDraft } from "@lib/util/order-edit-draft"
import Product from "@modules/products/ProductPage/product"
import type { ProductPickMode } from "@modules/products/ProductPage/product/details/details"

import PickBar from "./pick-bar"
import { editPath, pickShopPath } from "./shared"
import s from "./pick.module.scss"

/**
 * Stránka produktu v režimu výběru (mini obchod úpravy objednávky).
 *
 * „Přidat k objednávce #N" zapíše akci `add` do návrhu úpravy
 * (`sessionStorage`, viz `order-edit-draft`) a vrátí zákazníka na stránku
 * úpravy — souhrn se tam přepočítá sám. Skutečného košíku se nic nedotkne:
 * žádné `addToCart`, žádné cookies košíku.
 */
export default function OrderPickProduct({
  orderId,
  token,
  orderNumber,
  product,
  region,
  countryCode,
  allowedVariantIds,
}: {
  orderId: string
  token: string
  orderNumber: number
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  /** `allowed[product.id]` z katalogu úpravy. */
  allowedVariantIds: string[]
}) {
  const router = useRouter()

  const pick = useMemo<ProductPickMode>(
    () => ({
      label: `Přidat k objednávce #${orderNumber}`,
      allowedVariantIds,
      maxQuantity: MAX_ADD_QUANTITY,
      onPick: (variant, quantity) => {
        const result = addToDraft(orderId, {
          variant_id: variant.id,
          quantity,
          product_id: product.id,
          handle: product.handle ?? null,
          title: product.title ?? "Přidaný kus",
          // U produktu s jediným provedením je název varianty „Default"
          // apod. — chip by jen mátl.
          variant_title:
            (product.variants?.length ?? 0) > 1 ? variant.title ?? null : null,
          thumbnail: product.thumbnail ?? product.images?.[0]?.url ?? null,
          unit_price: variant.calculated_price?.calculated_amount ?? null,
          max_quantity: Math.max(
            1,
            Math.min(
              MAX_ADD_QUANTITY,
              maxPurchasableQuantity(variant, MAX_ADD_QUANTITY)
            )
          ),
        })
        if (result.ok) router.push(`/${countryCode}${editPath(orderId, token)}`)
        return result
      },
    }),
    [orderId, token, orderNumber, allowedVariantIds, product, countryCode, router]
  )

  return (
    <main>
      <div className={s.productTop}>
        <PickBar
          tone="dark"
          orderNumber={orderNumber}
          editHref={editPath(orderId, token)}
          shopHref={pickShopPath(orderId, token)}
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
