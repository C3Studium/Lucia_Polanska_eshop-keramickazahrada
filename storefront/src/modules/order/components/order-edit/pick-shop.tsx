"use client"

import type { HttpTypes } from "@medusajs/types"
import { useMemo } from "react"

import ECom from "@modules/store/Shop"
import type {
  ShopCategory,
  ShopNavCollection,
  ShopPickMode,
} from "@modules/store/Shop/types"

import PickBar, { type PickSwapInfo } from "./pick-bar"
import { editPath, pickProductPath } from "./shared"
import { useTexty } from "@lib/context/texty"

/**
 * Mini obchod úpravy objednávky — stávající výpis obchodu v režimu výběru.
 * Dvě podoby: přidání kusu k objednávce a výměna řádku za jiný výrobek
 * (§3d.10, `swap`). Liší se texty a tím, kam vede karta; výpis je tentýž.
 *
 * Obal existuje kvůli hranici server/klient: režim výběru nese funkci (kam
 * vede karta), a tu serverová stránka předat neumí. Tady se z dat (id
 * objednávky, token, povolené produkty) poskládá a výpis dostane hotový.
 */
export default function OrderPickShop({
  orderId,
  token,
  orderNumber,
  swap = null,
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
  /** Výměna řádku za jiný výrobek; `null` = přidání kusu. */
  swap?: PickSwapInfo | null
  /** `allowed` z katalogu úpravy — jen tyhle produkty výpis ukáže. */
  productIds: string[]
  countryCode: string
  products: HttpTypes.StoreProduct[]
  totalCount: number
  categories: ShopCategory[]
  navCollections: ShopNavCollection[]
}) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const pick = useMemo<ShopPickMode>(
    () => ({
      intro: swap
        ? {
            eyebrow: `Výměna v objednávce #${orderNumber}`,
            title: "Vyberte náhradu,",
            accent: `za ${swap.title}.`,
            text: swap.samePriceOnly
              ? `Objednávka je zabalená, proto jen výrobky ve stejné ceně. Vyměníme ${swap.quantity} ks.`
              : `Vyměníme ${swap.quantity} ks. Rozdíl ceny uvidíte v souhrnu úpravy, ještě než cokoli uložíte.`,
          }
        : {
            eyebrow: `Přidat k objednávce #${orderNumber}`,
            title: "Vyberte, co přidat,",
            accent: "pošleme to spolu.",
            text: texty["order.order_edit_24"],
          },
      productIds,
      productHref: (product) =>
        pickProductPath(orderId, token, product.handle ?? product.id, swap?.itemId),
      banner: (
        <PickBar
          orderNumber={orderNumber}
          swap={swap}
          editHref={editPath(orderId, token)}
        />
      ),
    }),
    [orderId, token, orderNumber, swap, productIds]
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
