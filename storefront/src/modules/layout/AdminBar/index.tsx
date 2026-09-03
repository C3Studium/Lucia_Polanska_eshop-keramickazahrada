"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ADMIN_BRIDGE_HINT_COOKIE } from "@lib/util/admin-bridge-hint"
import styles from "./style.module.scss"

/**
 * The admin bar — visible only to someone who came through the bridge.
 *
 * Client-side by design, which is worth explaining because a server component
 * would look like the tidier choice: product pages are statically prerendered,
 * and a server-rendered bar would be baked out of them at build time and never
 * appear on the pages it is most useful on. `app/api/admin-bridge/status`
 * carries the full reasoning.
 *
 * The check itself is still a server check — this component only asks. The
 * httpOnly cookie never reaches JavaScript, and a visitor who fabricates the
 * hint cookie gets `admin: false` and a bar that never renders.
 */

const PRODUCT_PATH = /^\/([a-z]{2})\/products\/([^/?#]+)/

/**
 * Only product pages get a targeted action. Every extra deep link is another
 * thing that silently rots when an admin route is renamed, and „vidím chybu,
 * chci ji opravit" is overwhelmingly a product moment.
 */
const actionFor = (pathname: string, backend: string) => {
  const product = PRODUCT_PATH.exec(pathname)
  if (product) {
    const [, country, handle] = product
    // The handle→id lookup is server-side, so no product id is ever rendered
    // into a public page: app/api/admin-bridge/product/[handle]/route.ts
    return {
      label: "Upravit produkt",
      href: `/api/admin-bridge/product/${handle}?cc=${country}`,
    }
  }
  return { label: "Přejít do adminu", href: `${backend}/app` }
}

type Session = { email: string; backendUrl: string }

const hasHint = (): boolean => {
  try {
    return document.cookie
      .split(";")
      .some((part) => part.trim().startsWith(`${ADMIN_BRIDGE_HINT_COOKIE}=`))
  } catch {
    return false
  }
}

const AdminBar = () => {
  const pathname = usePathname() || "/"
  const [session, setSession] = useState<Session | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    // A normal visitor never makes the request at all: the hint cookie is a
    // plain readable marker set alongside the real one. It grants nothing —
    // the answer still comes from the signed httpOnly cookie — it just spares
    // every other visitor a pointless round trip.
    if (!hasHint()) {
      return
    }
    let cancelled = false
    fetch("/api/admin-bridge/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.admin) {
          setSession({ email: data.email ?? "", backendUrl: data.backendUrl })
        }
      })
      .catch(() => {
        // Offline or blocked — no bar is the right outcome, not an error.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A bar that covers what you came to look at is worse than no bar.
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("kz-admin-bar-hidden") === "1")
    } catch {
      // Private window — the bar simply always starts open.
    }
  }, [])

  const collapse = (next: boolean) => {
    setHidden(next)
    try {
      localStorage.setItem("kz-admin-bar-hidden", next ? "1" : "0")
    } catch {
      // The choice just will not survive a reload.
    }
  }

  if (!session) {
    return null
  }

  if (hidden) {
    return (
      <button
        type="button"
        className={styles.pill}
        onClick={() => collapse(false)}
        aria-label="Zobrazit lištu administrátora"
      >
        <span className={styles.dot} aria-hidden="true" />
        admin
      </button>
    )
  }

  const action = actionFor(pathname, session.backendUrl)

  return (
    <aside className={styles.bar} aria-label="Lišta administrátora">
      <span className={styles.badge}>
        <span className={styles.dot} aria-hidden="true" />
        admin
      </span>

      {session.email ? <span className={styles.who}>{session.email}</span> : null}

      <a className={styles.action} href={action.href}>
        {action.label}
        <span aria-hidden="true"> ↗</span>
      </a>

      <button
        type="button"
        className={styles.ghost}
        onClick={() => collapse(true)}
      >
        Skrýt
      </button>

      <a
        className={styles.ghost}
        href={`/api/admin-bridge?logout=1&redirect=${encodeURIComponent(
          pathname
        )}`}
      >
        Odhlásit
      </a>
    </aside>
  )
}

export default AdminBar
