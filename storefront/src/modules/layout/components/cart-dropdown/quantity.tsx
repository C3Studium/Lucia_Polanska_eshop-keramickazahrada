"use client"

import { HttpTypes } from "@medusajs/types"
import { useState } from "react"

import { deleteLineItem, removeBundleFromCart, updateLineItem } from "@lib/data/cart"
import { maxPurchasableQuantity } from "@lib/util/availability"
import CartQuantityStepper from "@modules/cart/components/cart-quantity-stepper"

import styles from "./style.module.scss"

/**
 * Množství přímo v panelu košíku.
 *
 * Dřív tu bylo jen „Množství: 2" jako text a jediné, co šlo udělat, bylo celou
 * položku odebrat — na změnu jednoho kusu se muselo přes stránku košíku. Panel
 * přitom vyskočí hned po přidání do košíku, tedy právě ve chvíli, kdy člověk
 * nejčastěji zjistí, že chtěl dva.
 *
 * Spodní hranice je 0, ne 1: mínus u posledního kusu položku rovnou odebere.
 * Ovladač, který se u jedničky vypne, jinak nutí sáhnout vedle na „Odebrat" —
 * dvě tlačítka na jednu věc a jedno z nich zrovna nefunguje.
 *
 * Horní hranice je stejná jako na stránce košíku: co je skladem, nejvýš deset.
 * Kdyby ji panel neřešil, dozví se zákazník o stropu až chybou od backendu.
 */
const CartDropdownQuantity = ({
  item,
}: {
  item: HttpTypes.StoreCartLineItem
}) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bundleId = item.metadata?.bundle_id as string | undefined

  const zmenit = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    /*
     * Nula znamená odebrat. Sada přitom odchází celá — jednotlivý řádek je
     * jen jeden její kus a vytrhnout ho by nechalo v košíku nedodělek. Stejnou
     * cestou jde i sousední „Odebrat".
     */
    const akce =
      quantity > 0
        ? updateLineItem({ lineId: item.id, quantity })
        : bundleId
        ? removeBundleFromCart(bundleId)
        : deleteLineItem(item.id)

    await akce
      .catch((chyba) =>
        setError(chyba?.message || "Množství se nepovedlo změnit.")
      )
      .finally(() => setUpdating(false))
  }

  const strop = Math.min(maxPurchasableQuantity(item.variant, 10), 10)

  return (
    <div
      className={styles.quantity}
      data-testid="cart-item-quantity"
      data-value={item.quantity}
    >
      <CartQuantityStepper
        value={item.quantity}
        min={0}
        max={strop}
        disabled={updating}
        onChange={zmenit}
        decreaseLabel={
          item.quantity <= 1 ? "Odebrat z košíku" : "Snížit množství"
        }
        data-testid="cart-item-quantity-stepper"
      />
      {error ? <span className={styles.quantityError}>{error}</span> : null}
    </div>
  )
}

export default CartDropdownQuantity
