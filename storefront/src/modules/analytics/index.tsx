"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import {
  currentChoice,
  subscribeToConsent,
  type ConsentChoice,
} from "@lib/util/cookie-consent"

import {
  analyticsCookieNames,
  analyticsPlan,
  CONSENT_MODE_DEFAULT,
  cookieDeletionStrings,
  gaMeasurementId,
  GTAG_SCRIPT_ID,
  gtagScriptUrl,
} from "./consent-mode"

type Gtag = (...args: unknown[]) => void

type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: Gtag
}

const analyticsWindow = () => window as AnalyticsWindow

/**
 * Oficiální vypínač Google Analytics: s `window['ga-disable-<ID>'] = true` gtag.js neodešle
 * nic — ani bezcookiové pingy, které Consent Mode jinak posílá i při `denied`.
 */
function setGaDisabled(id: string, disabled: boolean) {
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = disabled
}

/**
 * Měřicí ID se do balíku zapéká při sestavení (`NEXT_PUBLIC_…`). Bez něj tahle komponenta
 * nenačte nic — žádný skript, žádný požadavek na Google.
 */
const MEASUREMENT_ID = gaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)

/** Studio (redakce webu) se neměří — není to návštěva obchodu. */
const isExcludedPath = (pathname: string) =>
  pathname === "/studio" || pathname.startsWith("/studio/")

/**
 * Google Analytics 4 — jen se souhlasem s analytickými cookies.
 *
 * Pořadí:
 * 1. Kořenový layout vloží `consentDefaultScript()` (`./consent-mode.ts`): `dataLayer`, `gtag`
 *    a výchozí stav Consent Mode v2 — vše `denied`. Google zatím nedostal ani bajt.
 * 2. Tahle komponenta po připojení přečte souhlas (`kz-cookie-consent`).
 *    - Bez souhlasu: nic se nestahuje, jen se smažou případné staré cookies `_ga*`
 *      (třeba z dřívějšího webu na téže doméně nebo po vypršení souhlasu).
 *    - Se souhlasem: `gtag('consent','update',{analytics_storage:'granted', …})`, pak
 *      `gtag('js')` + `gtag('config', ID)` do fronty a teprve potom se vloží
 *      `googletagmanager.com/gtag/js`. Knihovna po načtení zpracuje frontu popořadě, takže
 *      první měření už jede s povoleným stavem.
 * 3. Každá změna v liště (událost `kz:cookie-consent`) projde stejnou cestou. Odvolání:
 *    stav zpět na `denied`, `window['ga-disable-<ID>'] = true` (gtag.js pak neodešle nic,
 *    ani bezcookiové pingy) a smazání `_ga*` na naší doméně. Skript už stažený zůstane
 *    v paměti stránky, ale mlčí; při dalším načtení stránky se nestáhne vůbec.
 *
 * Přechody mezi stránkami (klientská navigace Next.js) měří GA4 sám přes „Rozšířené měření →
 * změny stránky podle historie prohlížeče", které je v GA4 zapnuté ve výchozím stavu.
 */
export default function Analytics() {
  const pathname = usePathname() || "/"
  const excluded = isExcludedPath(pathname)

  useEffect(() => {
    const apply = (choice: ConsentChoice) => {
      const plan = analyticsPlan(
        MEASUREMENT_ID,
        choice,
        Boolean(document.getElementById(GTAG_SCRIPT_ID)),
        excluded
      )

      switch (plan.kind) {
        case "off":
          // Přechod z obchodu do Studia v téže záložce: už načtené GA tam mlčí.
          if (MEASUREMENT_ID && excluded) setGaDisabled(MEASUREMENT_ID, true)
          if (plan.clearCookies) clearAnalyticsCookies()
          return

        case "deny": {
          setGaDisabled(plan.id, true)
          // gtag existuje jen tehdy, když ho layout vložil; jinak není co aktualizovat.
          analyticsWindow().gtag?.("consent", "update", plan.state)
          clearAnalyticsCookies()
          return
        }

        case "grant": {
          const gtag = ensureGtag(analyticsWindow())

          setGaDisabled(plan.id, false)
          gtag("consent", "update", plan.state)

          if (plan.load) {
            gtag("js", new Date())
            gtag("config", plan.id)
            injectGtag(plan.id)
          }
          return
        }
      }
    }

    apply(currentChoice())

    return subscribeToConsent(({ preferences, analytics, marketing }) =>
      apply({ preferences, analytics, marketing })
    )
  }, [excluded])

  return null
}

/**
 * Pojistka pro případ, že vložený skript z layoutu chybí (třeba ho vynechala stránka
 * s vlastním layoutem): stejný `gtag` a stejný výchozí stav, než se do fronty dá cokoli dalšího.
 */
function ensureGtag(w: AnalyticsWindow): Gtag {
  w.dataLayer = w.dataLayer || []

  if (typeof w.gtag !== "function") {
    // `arguments`, ne pole — gtag.js čte z dataLayer jen objekt arguments.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments)
    }
    w.gtag("consent", "default", CONSENT_MODE_DEFAULT)
  }

  return w.gtag
}

function injectGtag(id: string) {
  if (document.getElementById(GTAG_SCRIPT_ID)) return

  const script = document.createElement("script")

  script.id = GTAG_SCRIPT_ID
  script.async = true
  script.src = gtagScriptUrl(id)
  document.head.appendChild(script)
}

function clearAnalyticsCookies() {
  const names = analyticsCookieNames(document.cookie)

  if (!names.length) return

  for (const entry of cookieDeletionStrings(names, window.location.hostname)) {
    document.cookie = entry
  }
}
