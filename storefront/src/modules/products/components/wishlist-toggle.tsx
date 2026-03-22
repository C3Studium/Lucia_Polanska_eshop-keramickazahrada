"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "@medusajs/ui"
import Bookmark from "@modules/common/icons/bookmark"
import BookmarkFull from "@modules/common/icons/bookmark-full"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function WishlistToggle({ variantId, wishlistItems = [], onWishlistUpdateAction, isAuthenticated }: { 
  variantId?: string, 
  wishlistItems?: any[],
  onWishlistUpdateAction?: () => void,
  isAuthenticated?: boolean
}) {
  const [itemId, setItemId] = useState<string | null>(null)
  const [isAuthed, setIsAuthed] = useState<boolean | null>(isAuthenticated ?? null)
  const [loading, startTransition] = useTransition()
  const [localWishlistItems, setLocalWishlistItems] = useState<any[]>(wishlistItems)

  const inWishlist = useMemo(() => Boolean(itemId), [itemId])

  const fetchWishlist = async () => {
    try {
      const res = await fetch('/api/wishlist/items')
      const data = await res.json()
      if (data.success && data.wishlist) {
        setLocalWishlistItems(data.wishlist.items || [])
      }
    } catch (e) {
      console.error('Failed to fetch wishlist', e)
    }
  }

  //WIP: fix the issue with the wishlist, it says the item is not there, but it is. thats bigg issue. It needs to display full icon that it is in the wishlist

  console.log("WishlistToggle State:", {
    variantId,
    itemId,
    inWishlist,
    isAuthenticated,
    wishlistItemsCount: localWishlistItems?.length || 0,
    variantIdType: typeof variantId
  })

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!variantId || !isAuthenticated) {
      setItemId(null)
      return
    }
    console.log("WishlistToggle Debug:", {
      variantId,
      wishlistItems: localWishlistItems,
      isAuthenticated,
      wishlistItemsLength: localWishlistItems?.length,
      firstWishlistItem: localWishlistItems?.[0]
    })
    // Check if this variant is in the wishlist
    const found = localWishlistItems.find((i: any) => 
      i?.product_variant_id === variantId || 
      i?.product_variant?.id === variantId
    )
    console.log("Found wishlist item:", found)
    setItemId(found?.id || null)
  }, [variantId, localWishlistItems, isAuthenticated])

  useEffect(() => {
    setIsAuthed(isAuthenticated ?? null)
  }, [isAuthenticated])

  const toggle = async () => {
    if (!variantId) {
      toast.error("Vyberte variantu")
      return
    }
    startTransition(async () => {
      try {
        if (inWishlist && itemId) {
          const res = await fetch(`/api/wishlist/items/${itemId}`, { method: "DELETE" })
          if (!res.ok) throw new Error("Mazání selhalo")
          setItemId(null)
          toast.success("Odebráno z wishlistu")
          onWishlistUpdateAction?.()
          fetchWishlist()
        } else {
          const res = await fetch(`/api/wishlist/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variant_id: variantId }),
          })
          const data = await res.json()
          if (!res.ok || !data?.success) throw new Error(data?.message || "Přidání selhalo")
          
          // Optimistically update itemId if response includes the new item
          if (data?.item?.id) {
            setItemId(data.item.id)
          }
          
          toast.success("Přidáno do wishlistu")
          onWishlistUpdateAction?.()
          fetchWishlist()
        }
      } catch (e: any) {
        toast.error(e?.message || "Operace selhala")
      }
    })
  }

  if (isAuthenticated === false) {
    console.log("User not authenticated, showing login link, isAuthenticated:", isAuthenticated)
    return (
      <LocalizedClientLink href="/account" className="wishlist-login-link">
        <Bookmark size="24" color="var(--blackText)" />
      </LocalizedClientLink>
    )
  }

  console.log("User authenticated, showing toggle button, isAuthenticated:", isAuthenticated)

  return (
    <button
      type="button"
      className={`wishlist-toggle ${inWishlist ? "active" : ""}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={inWishlist}
      aria-label={inWishlist ? "Odebrat z wishlistu" : "Přidat do wishlistu"}
      title={inWishlist ? "Odebrat z wishlistu" : "Přidat do wishlistu"}
    >
      {inWishlist ? (
        <BookmarkFull size="24" />
      ) : (
        <Bookmark size="24" />
      )}
    </button>
  )
}
