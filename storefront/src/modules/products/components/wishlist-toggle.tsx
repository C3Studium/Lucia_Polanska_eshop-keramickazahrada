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
      toast.error("Nejprve vyberte provedení objektu.")
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
            throw new Error("Objekt se nepodařilo odebrat.")
          }

          toast.success("Objekt byl odebrán z oblíbených.")
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
            throw new Error(data?.message || "Objekt se nepodařilo uložit.")
          }

          const canonicalItems = data?.wishlist?.items
          if (Array.isArray(canonicalItems)) {
            updateWishlistState(canonicalItems)
          } else {
            await refreshWishlist()
          }

          toast.success("Objekt byl uložen do oblíbených.")
        } catch (saveError) {
          updateWishlistState(previousItems)
          throw saveError
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Změnu se nepodařilo uložit."
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
        aria-label="Přihlásit se a uložit objekt"
        title="Přihlásit se a uložit objekt"
      >
        <motion.span
          whileHover={{ scale: 1.08, rotate: -4 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.42, ease }}
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
          ? "Odebrat objekt z oblíbených"
          : "Uložit objekt do oblíbených"
      }
      title={
        inWishlist
          ? "Odebrat objekt z oblíbených"
          : "Uložit objekt do oblíbených"
      }
      initial={false}
      animate={inWishlist ? "saved" : "idle"}
      whileHover={isPending ? undefined : "hover"}
      whileTap={isPending ? undefined : { scale: 0.94 }}
      variants={{
        idle: { scale: 1 },
        hover: { scale: 1.06 },
        saved: { scale: [1, 1.12, 1] },
      }}
      transition={{ duration: 0.52, ease }}
    >
      <motion.span
        className={s.surface}
        variants={{
          idle: { scale: 0.2, opacity: 0 },
          hover: { scale: 0.68, opacity: 0.45 },
          saved: { scale: 1, opacity: 1 },
        }}
        transition={{ duration: 0.55, ease }}
        aria-hidden="true"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          className={s.icon}
          key={inWishlist ? "saved" : "idle"}
          initial={{ opacity: 0, scale: 0.65, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.68, rotate: 10 }}
          transition={{ duration: 0.38, ease }}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
      {isPending && (
        <motion.span
          className={s.pending}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        />
      )}
    </motion.button>
  )
}
