"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { currentChoice, subscribeToConsent } from "@lib/util/cookie-consent"

import {
  AHREFS_KEY,
  AHREFS_SCRIPT_ID,
  AHREFS_SCRIPT_URL,
  ahrefsPlan,
  isPrivateUrl,
} from "./ahrefs"

type AhrefsWindow = Window & {
  AhrefsAnalytics?: { sendEvent: (name: string) => void }
}

/** Adresa posledního odeslaného zobrazení — jedno zobrazení na stránku, i po změně souhlasu. */
let lastPageview: string | null = null

/**
 * Ahrefs Web Analytics — jen se souhlasem s analytickými cookies a jen na veřejných
 * stránkách (rozhodnutí v `./ahrefs.ts`).
 *
 * - Skript se vloží až po souhlasu, s `data-no-pageview-auto`: zobrazení stránek posílá tahle
 *   komponenta po každé změně cesty. Vlastní zachycení `history.pushState` ve skriptu by
 *   odeslalo adresu dřív, než se stihne poznat soukromá stránka (token v adrese).
 * - Ztlumení = odebrat `data-key`. Skript ho čte před každou událostí a bez něj ji zahodí
 *   (zobrazení, kliknutí na odkaz, odeslání formuláře). Tak mlčí na soukromých stránkách
 *   a po odvolání souhlasu, i když už je načtený.
 * - Na localhostu Ahrefs nic neposílá sám.
 */
export default function AhrefsAnalytics() {
  const pathname = usePathname() || "/"

  useEffect(() => {
    sync(currentChoice().analytics)

    return subscribeToConsent(({ analytics }) => sync(analytics))
  }, [pathname])

  return null
}

function sync(consent: boolean) {
  const { pathname, search, href } = window.location
  const script = document.getElementById(AHREFS_SCRIPT_ID) as HTMLScriptElement | null
  const plan = ahrefsPlan(consent, pathname, search, Boolean(script))

  if (plan.kind === "silent") {
    script?.removeAttribute("data-key")
    // Návrat ze soukromé stránky na tutéž veřejnou (výrobek → účet → výrobek) je nové
    // zobrazení. Po pouhém odvolání a vrácení souhlasu na téže stránce ne.
    if (isPrivateUrl(pathname, search)) lastPageview = null
    return
  }

  if (plan.load) {
    inject()
    return
  }

  script!.setAttribute("data-key", AHREFS_KEY)

  const api = (window as AhrefsWindow).AhrefsAnalytics

  // Skript se ještě stahuje — zobrazení pošle `onload` (znovu přes `sync`).
  if (api && href !== lastPageview) {
    lastPageview = href
    api.sendEvent("pageview")
  }
}

function inject() {
  const script = document.createElement("script")

  script.id = AHREFS_SCRIPT_ID
  script.async = true
  script.src = AHREFS_SCRIPT_URL
  script.setAttribute("data-key", AHREFS_KEY)
  script.setAttribute("data-no-pageview-auto", "")
  // Souhlas i stránka se mohly mezitím změnit — rozhodne se znovu.
  script.onload = () => sync(currentChoice().analytics)
  document.head.appendChild(script)
}
