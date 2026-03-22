"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import s from "../styles/deleteButton.module.scss"

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


function ScrollLink({
  text,
  textColor,
  "data-testid": dataTestId,
}: {
  href: string;
  text: string;
  className?: string;
  textColor?: string;
  borderColor?: string;
  borderR?: boolean;
  borderL?: boolean;
  "data-testid"?: string;
}) {
  return (
    <div className={s.ScrollLink} data-testid={dataTestId}
      style={{
      }}
    >
        <button 
          className={s.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={s.slider}>
                <div className={s.el}>
                    <PerspectiveText label={text} textColor={textColor}/>
                </div>
                <div className={s.el}>
                    <PerspectiveText label={text} textColor={textColor}/>
                </div>
            </div>
        </button>
    </div>
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
            {label}
          </p>
          <p 
            className={className}
            style={{
              color: textColor || "var(--blackText)",
            }}
          >
            {label}
          </p>
      </div>
  )
}