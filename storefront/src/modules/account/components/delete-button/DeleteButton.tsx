"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import s from "./delete-button.module.scss"
import PremiumActionButton from "@modules/common/components/premium-action-button"


export default function DeleteButton({
  "data-testid": dataTestId,
  itemId,
}: {
  "data-testid"?: string;
  itemId?: string;
}) {
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
    <PremiumActionButton
      text={pending || submitting ? "Odstraňuji…" : "Odstranit"}
      className={s.accountWishlistDelete}
      data-testid={dataTestId}
      onClickAction={onDelete}
      disabled={pending || submitting}
      compact
    />
  )
}
