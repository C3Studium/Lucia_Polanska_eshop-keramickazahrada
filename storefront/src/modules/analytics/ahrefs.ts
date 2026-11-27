/**
 * Ahrefs Web Analytics — čistá rozhodnutí (27. 11. 2026, Matěj). Prohlížečová část je
 * v `./ahrefs-analytics.tsx`, testy v `./ahrefs.test.mjs`.
 *
 * Měří jen se souhlasem s analytickými cookies, stejně jako Google Analytics — lišta to
 * slibuje („měření návštěvnosti … zapneme jen s vaším souhlasem"), i když Ahrefs cookies
 * neukládá.
 *
 * Skript posílá celou adresu stránky, cíle kliknutých odkazů i adresy odeslaných formulářů.
 * Na stránkách, kde je v adrese přístupový token (úprava objednávky z e-mailu, rezervace
 * kurzu, poukaz, obnova hesla) nebo kde jsou osobní údaje (účet), proto mlčí.
 */

export const AHREFS_SCRIPT_ID = "kz-ahrefs"
export const AHREFS_SCRIPT_URL = "https://analytics.ahrefs.com/analytics.js"
/** Veřejný klíč webu v Ahrefs — stojí v HTML každé měřené stránky, není tajný. */
export const AHREFS_KEY = "FVe/yf3pgtdNQN9cXvFLyQ"

/** Cesty bez kódu země (`/cz`), celé segmenty: `/order` neplatí pro `/orderly-…`. */
const PRIVATE_PATHS = [
  "/studio",
  "/order",
  "/kurzy/rezervace",
  "/poukaz",
  "/account",
  "/reset-password",
  "/verify-email",
]

/** Jméno parametru, který může nést přístup nebo osobní údaj. */
const SECRET_PARAM = /token|secret|sig|key|code|hash|pass|heslo|email/i

const withoutCountry = (pathname: string) => pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"

export function isPrivateUrl(pathname: string, search: string): boolean {
  const path = withoutCountry(pathname)

  if (PRIVATE_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return true

  return Array.from(new URLSearchParams(search).keys()).some((name) => SECRET_PARAM.test(name))
}

export type AhrefsPlan =
  /** Nenačítat; už načtený skript ztlumit (bez `data-key` každou událost zahodí). */
  | { kind: "silent" }
  /** Měřit; `load` = skript na stránce ještě není. */
  | { kind: "track"; load: boolean }

export function ahrefsPlan(
  analyticsConsent: boolean,
  pathname: string,
  search: string,
  loaded: boolean
): AhrefsPlan {
  if (!analyticsConsent || isPrivateUrl(pathname, search)) return { kind: "silent" }

  return { kind: "track", load: !loaded }
}
