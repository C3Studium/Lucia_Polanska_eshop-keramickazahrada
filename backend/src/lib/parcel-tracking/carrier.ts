/**
 * Česká pošta jako dopravce — odkazy a názvy, jak je vidí zákazník
 * (docs/sledovani-zasilek.md §3 konec, §5).
 *
 * Bez závislostí, ať to může importovat subscriber e-mailů i admin route.
 * `cpTrackingUrl` je tatáž adresa, jakou provider zapisuje do
 * `labels[].tracking_url` — kdyby se lišily, zákazník by z e-mailu „odesláno"
 * a z e-mailu dopravce skočil na dvě různé stránky.
 */

export const CP_CARRIER = "ceska-posta"

export const CP_TRACKING_URL_BASE =
  "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers="

export const cpTrackingUrl = (parcelCode?: string | null): string => {
  const code = (parcelCode ?? "").trim()
  return code ? `${CP_TRACKING_URL_BASE}${encodeURIComponent(code)}` : ""
}

/**
 * `NB` → Balíkovna, `DR` → Do ruky; bez kódu služby zůstává název dopravní
 * metody — e-mail nemá tvrdit dopravce, kterého objednávka nepoužila.
 */
export const cpCarrierName = (
  serviceCode?: string | null,
  fallbackName?: string | null
): string => {
  const code = String(serviceCode ?? "").toUpperCase()
  if (code === "NB") return "Česká pošta – Balíkovna"
  if (code === "DR") return "Česká pošta"
  return (fallbackName ?? "").trim()
}

/**
 * Simulace stavů je jen pro testovací prostředí: zapnutá výslovně
 * (`CP_TRACKING_SIMULATE=1`) nebo tam, kde podání jede proti `b2b-test`.
 * Čistá funkce nad předaným env, aby pravidlo šlo otestovat bez mutace
 * `process.env`.
 */
export const isSimulateAllowed = (
  env: Record<string, string | undefined> = process.env
): boolean =>
  env.CP_TRACKING_SIMULATE === "1" ||
  String(env.BALIKOVNA_API_URL ?? "").includes("b2b-test")
