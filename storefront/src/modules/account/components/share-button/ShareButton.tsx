"use client"

import { useState } from "react"

import s from "./share-button.module.scss"
import PremiumActionButton from "@modules/common/components/premium-action-button"


export default function ShareButton({
  "data-testid": dataTestId,
}: {
  "data-testid"?: string;
}) {
  const [submitting, setSubmitting] = useState(false)

  // WIP: replace the current-page share with a backend-generated public wishlist token.
  const onShare = async () => {
    if (submitting) return
    try {
      setSubmitting(true)
      const url = window.location.href
      if (navigator.share) {
        await navigator.share({
          title: "Moje oblíbené · Keramická zahrada",
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        console.error(e)
      }
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <PremiumActionButton
      text={submitting ? "Sdílím…" : "Sdílet"}
      className={s.accountWishlistShare}
      data-testid={dataTestId}
      onClickAction={onShare}
      disabled={submitting}
      compact
    />
  )
}
