"use client"

import Image from "next/image"
import { Suspense } from "react"
import { StoreCart, StoreRegion } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Cart from "@modules/common/icons/cart"

import CartButton from "../cart"
import RegionsSelect from "../regions"
import styles from "./style.module.scss"

type MobileBarProps = {
  cart: StoreCart | null
  regions: StoreRegion[]
  wishlistItems?: any[]
}

/**
 * The phone bottom bar: the shop's own controls, within reach of a thumb.
 *
 * Its own markup rather than the top bar's `.navbar__right` moved with CSS. Repositioning that
 * element meant the two layouts had to share one set of children, which is exactly what they
 * should not do — the top bar drops the country selector and the wishlist for width, and down
 * here there is room for both.
 *
 * The links carry this module's classes and none of the navbar's. That is deliberate: reusing
 * `navbar__utility-link` and `navbar__cart` meant every rule written for a dense row of six
 * controls under a mouse landed here too — 36px marks, a count set beside the cart icon instead
 * of on it — and each one had to be overridden from the outside. Four equal slots, sized here,
 * with nothing to undo.
 *
 * It still renders inside `<nav class="navbar">`: the country selector brings its own dropdown,
 * which is styled as a descendant of `.navbar`, and that is worth keeping.
 */
export default function MobileBar({
  cart,
  regions,
  wishlistItems = [],
}: MobileBarProps) {
  return (
    <div
      className={`${styles.root} navbar__bottomBar`}
      aria-label="Rychlé ovládání obchodu"
    >
      <div className={`${styles.slot} ${styles.regionSlot}`}>
        <RegionsSelect regions={regions} />
      </div>

      <div className={styles.slot}>
        <LocalizedClientLink
          href="/account/wishlist"
          className={styles.link}
          aria-label="Oblíbené produkty"
        >
          <Image
            src="/assets/icons/bookmark.svg"
            alt=""
            width={24}
            height={24}
            className={styles.icon}
          />
          {wishlistItems.length > 0 && (
            <span className={styles.count}>{wishlistItems.length}</span>
          )}
        </LocalizedClientLink>
      </div>

      <div className={`${styles.slot} ${styles.cartSlot}`}>
        <Suspense
          fallback={
            <LocalizedClientLink
              className={styles.link}
              href="/cart"
              aria-label="Košík"
              data-testid="nav-cart-link"
            >
              <Cart size="24" />
            </LocalizedClientLink>
          }
        >
          <CartButton cart={cart} />
        </Suspense>
      </div>

      <div className={styles.slot}>
        <LocalizedClientLink
          href="/account"
          className={styles.link}
          aria-label="Uživatelský účet"
        >
          <Image
            src="/assets/icons/user.svg"
            alt=""
            width={24}
            height={24}
            className={styles.icon}
          />
        </LocalizedClientLink>
      </div>
    </div>
  )
}
