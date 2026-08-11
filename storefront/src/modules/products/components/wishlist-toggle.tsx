"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Bookmark from "@modules/common/icons/bookmark"
import BookmarkFull from "@modules/common/icons/bookmark-full"
import { toast } from "@medusajs/ui"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useMemo, useState } from "react"
import s from "./wishlist-toggle.module.scss"

type WishlistItem = {
  id?: string
  product_variant_id?: string
  product_variant?: { id?: string }
}

type WishlistToggleProps = {
  variantId?: string
  wishlistItems?: WishlistItem[]
  isAuthenticated?: boolean
}

const ease = [0.22, 1, 0.36, 1] as const
const wishlistUpdateEvent = "keramicka-zahrada:wishlist-updated"

const findWishlistItem = (items: WishlistItem[], variantId?: string) =>
  items.find(
    (item) =>
      item.product_variant_id === variantId ||
      item.product_variant?.id === variantId
  )

export default function WishlistToggle({
  variantId,
  wishlistItems = [],
  isAuthenticated,
}: WishlistToggleProps) {
  const [localItems, setLocalItems] = useState<WishlistItem[]>(wishlistItems)
  const [isPending, setIsPending] = useState(false)

  const updateWishlistState = useCallback((items: WishlistItem[]) => {
    setLocalItems(items)

    window.dispatchEvent(
      new CustomEvent(wishlistUpdateEvent, { detail: { items } })
    )
  }, [])

  useEffect(() => {
    setLocalItems(wishlistItems)
  }, [wishlistItems])

  useEffect(() => {
    const syncWishlistState = (event: Event) => {
      const items = (event as CustomEvent<{ items?: WishlistItem[] }>).detail
        ?.items

      if (Array.isArray(items)) {
        setLocalItems(items)
      }
    }

    window.addEventListener(wishlistUpdateEvent, syncWishlistState)
    return () =>
      window.removeEventListener(wishlistUpdateEvent, syncWishlistState)
  }, [])

  const currentItem = useMemo(
    () => findWishlistItem(localItems, variantId),
    [localItems, variantId]
  )
  const inWishlist = Boolean(currentItem?.id)

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await fetch("/api/wishlist/items")
      const data = await response.json()

      if (response.ok && data.success && data.wishlist) {
        updateWishlistState(data.wishlist.items || [])
      }
    } catch {
      // The optimistic state remains usable if the background refresh fails.
    }
  }, [isAuthenticated, updateWishlistState])

  useEffect(() => {
    void refreshWishlist()
  }, [refreshWishlist])

  const toggle = async () => {
    if (!variantId) {
      toast.error("Nejdřív prosím vyberte provedení.")
      return
    }

    const previousItems = localItems
    setIsPending(true)

    try {
      if (inWishlist && currentItem?.id) {
        const nextItems = localItems.filter(
          (item) => item.id !== currentItem.id
        )
        updateWishlistState(nextItems)

        try {
          const response = await fetch(
            `/api/wishlist/items/${currentItem.id}`,
            { method: "DELETE" }
          )

          if (!response.ok) {
            throw new Error("Nepovedlo se to odebrat.")
          }

          toast.success("Odebráno z oblíbených.")
        } catch (removeError) {
          updateWishlistState(previousItems)
          throw removeError
        }
      } else {
        const optimisticItem: WishlistItem = {
          id: `optimistic-${variantId}`,
          product_variant_id: variantId,
          product_variant: { id: variantId },
        }
        const optimisticItems = [
          ...localItems.filter(
            (item) =>
              item.product_variant_id !== variantId &&
              item.product_variant?.id !== variantId
          ),
          optimisticItem,
        ]
        updateWishlistState(optimisticItems)

        try {
          const response = await fetch("/api/wishlist/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variant_id: variantId }),
          })
          const data = await response.json()

          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Nepovedlo se to uložit.")
          }

          const canonicalItems = data?.wishlist?.items
          if (Array.isArray(canonicalItems)) {
            updateWishlistState(canonicalItems)
          } else {
            await refreshWishlist()
          }

          toast.success("Uloženo do oblíbených.")
        } catch (saveError) {
          updateWishlistState(previousItems)
          throw saveError
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Změnu se nepovedlo uložit."
      )
    } finally {
      setIsPending(false)
    }
  }

  const icon = inWishlist ? (
    <BookmarkFull size="22" color="#ffe8d6" />
  ) : (
    <Bookmark size="22" color="#ffe8d6" />
  )

  if (isAuthenticated === false) {
    return (
      <LocalizedClientLink
        href="/account"
        className={s.login}
        aria-label="Přihlásit se a uložit do oblíbených"
        title="Přihlásit se a uložit do oblíbených"
      >
        <motion.span
          whileHover={whileHover}
          whileTap={whileTap}
          transition={transition}
        >
          {icon}
        </motion.span>
      </LocalizedClientLink>
    )
  }

  return (
    <motion.button
      type="button"
      className={s.button}
      onClick={() => void toggle()}
      disabled={isPending}
      data-saved={inWishlist ? "true" : "false"}
      aria-pressed={inWishlist}
      aria-label={
        inWishlist
          ? "Odebrat z oblíbených"
          : "Uložit do oblíbených"
      }
      title={
        inWishlist
          ? "Odebrat z oblíbených"
          : "Uložit do oblíbených"
      }
      initial={false}
      animate={inWishlist ? "saved" : "idle"}
      whileHover={isPending ? undefined : "hover"}
      whileTap={isPending ? undefined : { scale: 0.94 }}
      variants={variants}
      transition={transition2}
    >
      <motion.span
        className={s.surface}
        variants={variants2}
        transition={transition3}
        aria-hidden="true"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          className={s.icon}
          key={inWishlist ? "saved" : "idle"}
          initial={initial}
          animate={animate}
          exit={exit}
          transition={transition4}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
      {isPending && (
        <motion.span
          className={s.pending}
          animate={animate2}
          transition={transition5}
          aria-hidden="true"
        />
      )}
    </motion.button>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const whileHover = { scale: 1.08, rotate: -4 }
const whileTap = { scale: 0.94 }
const transition = { duration: 0.42, ease }
const variants = {
        idle: { scale: 1 },
        hover: { scale: 1.06 },
        saved: { scale: [1, 1.12, 1] },
      }
const transition2 = { duration: 0.52, ease }
const variants2 = {
          idle: { scale: 0.2, opacity: 0 },
          hover: { scale: 0.68, opacity: 0.45 },
          saved: { scale: 1, opacity: 1 },
        }
const transition3 = { duration: 0.55, ease }
const initial = { opacity: 0, scale: 0.65, rotate: -12 }
const animate = { opacity: 1, scale: 1, rotate: 0 }
const exit = { opacity: 0, scale: 0.68, rotate: 10 }
const transition4 = { duration: 0.38, ease }
const animate2 = { rotate: 360 }
const transition5 = { duration: 0.9, repeat: Infinity, ease: "linear" as const }
