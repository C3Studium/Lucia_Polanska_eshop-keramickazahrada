"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

/** Jak často se otevřená stránka ptá na verzi obsahu. */
const POLL_MS = 30_000

/**
 * Změny z administrace a Studia se v otevřené stránce ukážou samy
 * (15. 11. 2026). Každých 30 s a při návratu do karty se zeptá na verzi
 * obsahu (`/api/content-version`); když je jiná, než s jakou se stránka
 * načetla, udělá `router.refresh()` — serverové části se načtou znovu,
 * rozepsaná pole, košík i poloha na stránce zůstanou.
 *
 * Když zákazník zrovna píše do pole, obnova počká na další kolo. Ve Studiu
 * (náhled, úpravy) se nespouští — tam se obsah obnovuje sám.
 */
export default function ContentFreshness() {
  const router = useRouter()
  const pathname = usePathname()
  const known = useRef<string | null>(null)

  useEffect(() => {
    if (pathname?.startsWith("/studio")) return
    let cancelled = false

    const check = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const response = await fetch("/api/content-version", { cache: "no-store" })
        if (!response.ok) return
        const { version } = (await response.json()) as { version?: string }
        if (cancelled || !version) return
        if (known.current === null) {
          known.current = version
          return
        }
        if (version === known.current) return
        const active = document.activeElement
        const typing =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        if (typing) return
        known.current = version
        router.refresh()
      } catch {
        /* Bez sítě nic — příště znovu. */
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), POLL_MS)
    const onVisible = () => void check()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [pathname, router])

  return null
}
