"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import s from "./share-button.module.scss"
import { Share } from "@medusajs/icons";


export default function ShareButton({
  "data-testid": dataTestId,
  itemId,
}: {
  "data-testid"?: string;
  itemId?: string;
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)

  //WIP - to be implemented - share token for the wishlist - need to be done properly with backend and seo etc.
  const onShare = async () => {
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
      className={s.ScrollLink} 
      data-testid={dataTestId}
      type="button"
      onClick={onShare}
      disabled={pending || submitting}
      aria-label="Sdílet"
      title="Sdílet"
    >
        <div 
          className={s.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={s.slider}>
                <div className={s.el}>
                    <PerspectiveText label={pending ? "Odstraňuji..." : "Odstranit"}/>
                </div>
                <div className={s.el}>
                    <PerspectiveText label={pending ? "Odstraňuji..." : "Odstranit"}/>
                </div>
            </div>
        </div>
    </button>
  );
}

function PerspectiveText({label, className, textColor}: {label: string; className?: string; textColor?: string}) {
  return (    
      <div className={s.perspectiveText}>
          <p 
            className={className}
            style={{
              color: textColor || "var(--blackText)",
            }}
          >
            Sdílet &nbsp;
            <Share width={20} height={20}/>
          </p>
          <p 
            className={className}
            style={{
              color: textColor || "var(--blackText)",
            }}
          >
            Sdílet &nbsp;
            <Share width={20} height={20}/>
          </p>
      </div>
  )
}