/**
 * Google Analytics 4 a Google Consent Mode v2 — čistá logika bez DOMu.
 *
 * Tady se rozhoduje, CO se má stát; `./index.tsx` to v prohlížeči provede. Odděleno, aby
 * rozhodnutí šlo otestovat bez prohlížeče (`./consent-mode.test.mjs`, spouští se přes
 * `node --experimental-strip-types`). Proto tenhle soubor nesmí za běhu nic importovat —
 * jen typy, které se při spuštění zahodí.
 *
 * Pravidla (LEGAL_AUDIT.md § 8, § 89 odst. 3 zákona 127/2005 Sb.):
 * - Bez `NEXT_PUBLIC_GA_MEASUREMENT_ID` se nenačte vůbec nic — ani výchozí stav souhlasu.
 * - S ID se hned na začátku stránky nastaví výchozí stav Consent Mode: všechno `denied`.
 * - Skript `gtag.js` od Googlu se stáhne AŽ po souhlasu s analytickými cookies. To je přísnější
 *   než samotný Consent Mode, který by skript načetl hned a posílal „cookieless" pingy —
 *   i to je přenos dat Googlu bez souhlasu.
 * - Reklamní signály (`ad_storage`, `ad_user_data`, `ad_personalization`) jen s marketingovým
 *   souhlasem.
 * - Po odvolání: stav zpět na `denied`, `ga-disable-<ID>` (Google pak neposílá nic) a smazání
 *   cookies `_ga*` na naší doméně.
 */

import type { ConsentChoice } from "@lib/util/cookie-consent"

export type ConsentModeValue = "granted" | "denied"

export type ConsentModeState = {
  ad_storage: ConsentModeValue
  analytics_storage: ConsentModeValue
  ad_user_data: ConsentModeValue
  ad_personalization: ConsentModeValue
}

/** Výchozí stav před jakýmkoli rozhodnutím — všechno zakázané. */
export const CONSENT_MODE_DEFAULT: ConsentModeState & { wait_for_update: number } = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  wait_for_update: 500,
}

/** `id` elementu se skriptem gtag.js — podle něj se pozná, že už je načtený. */
export const GTAG_SCRIPT_ID = "kz-gtag"

/** Adresa knihovny Googlu. Načítá se jen po souhlasu (viz {@link analyticsPlan}). */
export const gtagScriptUrl = (measurementId: string) =>
  `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`

/**
 * Měřicí ID z proměnné prostředí, nebo `null`.
 *
 * Kontroluje se tvar `G-XXXXXXX`: hodnota jde do adresy skriptu a do vloženého skriptu,
 * takže cokoli jiného (překlep, mezera, omylem vložený celý tag) se raději nenačte vůbec.
 */
export function gaMeasurementId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim()

  return /^G-[A-Z0-9]{4,20}$/i.test(value) ? value.toUpperCase() : null
}

/** Rozhodnutí návštěvníka → stav Consent Mode v2. */
export function consentModeState(choice: ConsentChoice): ConsentModeState {
  const analytics: ConsentModeValue = choice.analytics ? "granted" : "denied"
  const ads: ConsentModeValue = choice.analytics && choice.marketing ? "granted" : "denied"

  return {
    ad_storage: ads,
    analytics_storage: analytics,
    ad_user_data: ads,
    ad_personalization: ads,
  }
}

export type AnalyticsPlan =
  /** Bez ID / na stránce bez měření: nic nenačítat, jen uklidit případné staré `_ga*`. */
  | { kind: "off"; clearCookies: boolean }
  /** Souhlas: aktualizovat stav, a pokud gtag.js ještě není, načíst ho. */
  | { kind: "grant"; id: string; state: ConsentModeState; load: boolean }
  /** Bez souhlasu / odvolání: stav na `denied`, vypnout odesílání, smazat `_ga*`. */
  | { kind: "deny"; id: string; state: ConsentModeState }

/**
 * Co udělat při načtení stránky a po každé změně souhlasu.
 *
 * @param id       výsledek {@link gaMeasurementId}
 * @param choice   aktuální rozhodnutí (bez rozhodnutí = vše `false`)
 * @param loaded   jestli už je gtag.js na stránce
 * @param excluded stránka, kde se neměří (Studio — redakce webu)
 */
export function analyticsPlan(
  id: string | null,
  choice: ConsentChoice,
  loaded: boolean,
  excluded = false
): AnalyticsPlan {
  if (!id || excluded) {
    return { kind: "off", clearCookies: !choice.analytics }
  }

  if (!choice.analytics) {
    return { kind: "deny", id, state: consentModeState(choice) }
  }

  return { kind: "grant", id, state: consentModeState(choice), load: !loaded }
}

/**
 * Vložený skript pro `<body>` kořenového layoutu: `dataLayer`, `gtag` a výchozí stav souhlasu
 * dřív než cokoli jiného. Prázdný řetězec bez platného ID — pak se nevloží nic.
 *
 * `gtag` musí do `dataLayer` posílat objekt `arguments`, ne pole — jinak ho gtag.js ignoruje.
 */
export function consentDefaultScript(id: string | null): string {
  if (!id) return ""

  return (
    "window.dataLayer=window.dataLayer||[];" +
    "window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};" +
    `window.gtag("consent","default",${JSON.stringify(CONSENT_MODE_DEFAULT)});` +
    'window.gtag("set","ads_data_redaction",true);'
  )
}

/** Je to cookie Google Analytics? (`_ga`, `_ga_<ID>`, starší `_gid`, `_gat*`.) */
export const isAnalyticsCookie = (name: string) => /^_ga/.test(name) || name === "_gid"

/** Názvy cookies GA v `document.cookie`. */
export function analyticsCookieNames(cookieString: string): string[] {
  const names = new Set<string>()

  for (const part of cookieString.split(";")) {
    const name = part.split("=")[0]?.trim()

    if (name && isAnalyticsCookie(name)) names.add(name)
  }

  return Array.from(names)
}

/**
 * Domény, na kterých může cookie `_ga` ležet.
 *
 * GA si cookie zapisuje na nejvyšší doménu, kam smí (`cookie_domain: "auto"`) — na
 * `www.keramickazahrada.cz` tedy na `keramickazahrada.cz`. Smazat ji jde jen se stejnou
 * doménou, jakou měla při zápisu, proto se zkouší všechny od aktuální výš (bez samotné
 * koncovky — tu prohlížeč odmítne). Prázdný řetězec = cookie jen pro tuto adresu (bez Domain).
 */
export function cookieDomainCandidates(hostname: string): string[] {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "")

  // IP adresa nebo `localhost`: Domain se tu nepoužívá.
  if (!host || !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) {
    return [""]
  }

  const labels = host.split(".")
  const domains = [""]

  for (let i = 0; i <= labels.length - 2; i += 1) {
    domains.push(labels.slice(i).join("."))
  }

  return domains
}

/** Řetězce pro `document.cookie`, které smažou dané cookies na všech kandidátních doménách. */
export function cookieDeletionStrings(names: string[], hostname: string): string[] {
  const domains = cookieDomainCandidates(hostname)
  const expired = "Thu, 01 Jan 1970 00:00:00 GMT"

  return names.flatMap((name) =>
    domains.map(
      (domain) =>
        `${name}=; Expires=${expired}; Max-Age=0; Path=/` +
        (domain ? `; Domain=${domain}` : "")
    )
  )
}
