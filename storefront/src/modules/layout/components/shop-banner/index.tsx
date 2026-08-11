"use client"

import { useEffect, useMemo, useState } from "react"
import type { ShopStatus } from "@lib/data/shop-status"
import styles from "./style.module.scss"

/**
 * The rotating banner at the top of every page — the owner's voice.
 *
 * Messages come from the backend (vacation first, then announcements) and
 * rotate every few seconds when there is more than one. The ✕ dismisses —
 * remembered in localStorage keyed by the CONTENT, so a new message
 * reappears even for someone who closed the last one.
 */
const ROTATE_MS = 6000

export default function ShopBanner({ status }: { status: ShopStatus | null }) {
  const messages = useMemo(() => {
    const list: { text: string; link?: string | null }[] = []
    if (status?.vacation) {
      const until = status.vacation.until
        ? ` Zakázky přijímáme znovu po ${status.vacation.until
            .split("-")
            .reverse()
            .join(". ")}.`
        : ""
      list.push({ text: `${status.vacation.message}${until}` })
    }
    if (status?.announcement)
      list.push({
        text: status.announcement.message,
        link: status.announcement.link ?? null,
      })
    return list
  }, [status])

  const storageKey = useMemo(
    () => `kz-banner-dismissed:${messages.map((m) => m.text).join("|")}`,
    [messages]
  )

  const [dismissed, setDismissed] = useState(true)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!messages.length) return
    try {
      setDismissed(localStorage.getItem(storageKey) === "1")
    } catch {
      setDismissed(false)
    }
  }, [messages, storageKey])

  useEffect(() => {
    if (messages.length < 2) return
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      ROTATE_MS
    )
    return () => clearInterval(timer)
  }, [messages])

  if (!messages.length || dismissed) return null

  return (
    <div className={styles.banner} role="status">
      <span key={index} className={styles.message}>
        {messages[index % messages.length].text}
        {messages[index % messages.length].link && (
          <a
            href={messages[index % messages.length].link!}
            target="_blank"
            rel="noreferrer"
            className={styles.action}
          >
            Víc informací
          </a>
        )}
      </span>
      <button
        type="button"
        className={styles.close}
        aria-label="Skrýt oznámení"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(storageKey, "1")
          } catch {
            // Private windows forbid storage; hiding for the visit is enough.
          }
        }}
      >
        ✕
      </button>
    </div>
  )
}
