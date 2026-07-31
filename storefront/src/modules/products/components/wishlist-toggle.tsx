"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Bookmark from "@modules/common/icons/bookmark"
import BookmarkFull from "@modules/common/icons/bookmark-full"
import { toast } from "@medusajs/ui"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import s from "./wishlist-toggle.module.scss"

type WishlistItem = {
  id?: string
  product_variant_id?: string
  product_variant?: { id?: string }
}

type WishlistToggleProps = {
  variantId?: string
  wishlistItems?: WishlistItem[]
  onWishlistUpdateAction?: () => void | Promise<void>
  isAuthenticated?: boolean
}

const ease = [0.22, 1, 0.36, 1] as const

const findWishlistItem = (items: WishlistItem[], variantId?: string) =>
  items.find(
    (item) =>
      item.product_variant_id === variantId ||
      item.product_variant?.id === variantId
  )

export default function WishlistToggle({
  variantId,
  wishlistItems = [],
  onWishlistUpdateAction,
  isAuthenticated,
}: WishlistToggleProps) {
  const [localItems, setLocalItems] = useState<WishlistItem[]>(wishlistItems)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLocalItems(wishlistItems)
  }, [wishlistItems])

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
        setLocalItems(data.wishlist.items || [])
      }
    } catch {
      // The optimistic state remains usable if the background refresh fails.
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refreshWishlist()
  }, [refreshWishlist])

  const toggle = () => {
    if (!variantId) {
      toast.error("Nejprve vyberte provedení objektu.")
      return
    }

    startTransition(async () => {
      try {
        if (inWishlist && currentItem?.id) {
          const previousItems = localItems
          setLocalItems((items) =>
            items.filter((item) => item.id !== currentItem.id)
          )

          const response = await fetch(
            `/api/wishlist/items/${currentItem.id}`,
            { method: "DELETE" }
          )
          if (!response.ok) {
            setLocalItems(previousItems)
            throw new Error("Objekt se nepodařilo odebrat.")
          }
          toast.success("Objekt byl odebrán z oblíbených.")
        } else {
          const response = await fetch("/api/wishlist/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variant_id: variantId }),
          })
          const data = await response.json()

          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Objekt se nepodařilo uložit.")
          }

          if (data?.item) {
            setLocalItems((items) => [
              ...items.filter(
                (item) =>
                  item.product_variant_id !== variantId &&
                  item.product_variant?.id !== variantId
              ),
              data.item,
            ])
          }
          toast.success("Objekt byl uložen do oblíbených.")
        }

        await onWishlistUpdateAction?.()
        await refreshWishlist()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Změnu se nepodařilo uložit."
        )
      }
    })
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
      onClick={toggle}
      disabled={isPending}
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
