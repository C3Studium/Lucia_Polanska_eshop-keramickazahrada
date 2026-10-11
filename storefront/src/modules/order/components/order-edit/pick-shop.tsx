"use client"

import type { HttpTypes } from "@medusajs/types"
import { useMemo } from "react"

import ECom from "@modules/store/Shop"
import type {
  ShopCategory,
  ShopNavCollection,
  ShopPickMode,
} from "@modules/store/Shop/types"

import PickBar from "./pick-bar"
import { editPath, pickProductPath } from "./shared"

/**
 * Mini obchod úpravy objednávky — stávající výpis obchodu v režimu výběru.
 *
 * Obal existuje kvůli hranici server/klient: režim výběru nese funkci (kam
 * vede karta), a tu serverová stránka předat neumí. Tady se z dat (id
 * objednávky, token, povolené produkty) poskládá a výpis dostane hotový.
 */
export default function OrderPickShop({
  orderId,
  token,
  orderNumber,
  productIds,
  countryCode,
  products,
  totalCount,
  categories,
  navCollections,
}: {
  orderId: string
  token: string
  orderNumber: number
  /** `allowed` z katalogu úpravy — jen tyhle produkty výpis ukáže. */
  productIds: string[]
  countryCode: string
  products: HttpTypes.StoreProduct[]
  totalCount: number
  categories: ShopCategory[]
  navCollections: ShopNavCollection[]
}) {
  const pick = useMemo<ShopPickMode>(
    () => ({
      orderNumber,
      productIds,
      productHref: (product) =>
        pickProductPath(orderId, token, product.handle ?? product.id),
      banner: (
        <PickBar orderNumber={orderNumber} editHref={editPath(orderId, token)} />
      ),
    }),
    [orderId, token, orderNumber, productIds]
  )

  return (
    <ECom
      countryCode={countryCode}
      products={products}
      categories={categories}
      navCollections={navCollections}
      totalCount={totalCount}
      pick={pick}
    />
  )
}
