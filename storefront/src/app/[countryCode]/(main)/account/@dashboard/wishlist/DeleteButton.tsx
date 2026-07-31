"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

export default function DeleteButton({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)

  const onDelete = async () => {
    if (!itemId || submitting) return
    try {
      setSubmitting(true)
      const res = await fetch(`/api/wishlist/items/${itemId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
      })
      if (!res.ok) {
        // optionally surface error
        console.error("Failed to delete wishlist item", await res.text())
        // WIP: finish all functionality to this page
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
      startTransition(() => router.refresh())
    }
  }

  return (
    <button
      type="button"
      className="wishlist-remove"
      onClick={onDelete}
      disabled={pending || submitting}
      aria-label="Odstranit z wishlistu"
      title="Odstranit z wishlistu"
    >
      {pending || submitting ? "Odstraňuji…" : "Odstranit"}
    </button>
  )
}
