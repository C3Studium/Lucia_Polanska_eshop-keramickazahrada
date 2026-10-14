import { ALL_VERSIONS } from "./documents"
import manifest from "./pdf-manifest.json"
import type { LegalDocumentVersion, LegalPdfEntry, LegalSlug } from "./types"

/**
 * Registr právních dokumentů — jediný zdroj pro stránky, tisk do PDF,
 * checkout (verze OP k objednávce) i e-maily (přes `pdf-manifest.json`,
 * jehož kopii má backend).
 *
 * Verze = datum účinnosti. „Platná" je nejnovější verze, jejíž datum už
 * nastalo (pražské datum); novější s budoucím datem je „připravovaná".
 */

/** URL stránky dokumentu (bez prefixu země). */
export const LEGAL_PATHS: Record<LegalSlug, string> = {
  "obchodni-podminky": "/smluvni-podminky",
  "reklamacni-rad": "/reklamacni-rad",
  "reklamacni-protokol": "/reklamacni-protokol",
  "odstoupeni-od-smlouvy": "/odstoupeni-od-smlouvy",
  "ochrana-osobnich-udaju": "/ochrana-osobnich-udaju",
  cookies: "/cookies",
  "doprava-a-platba": "/doprava-a-platba",
}

/** Dnešní datum v Praze jako `YYYY-MM-DD` (verze se porovnávají jako řetězce). */
export const pragueToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

/** Všechny verze dokumentu, od nejnovější. */
export const listVersions = (slug: LegalSlug): LegalDocumentVersion[] =>
  ALL_VERSIONS.filter((doc) => doc.slug === slug).sort((a, b) =>
    b.version.localeCompare(a.version)
  )

export const getVersion = (
  slug: LegalSlug,
  version: string
): LegalDocumentVersion | null =>
  ALL_VERSIONS.find((doc) => doc.slug === slug && doc.version === version) ?? null

/**
 * Platná verze k danému dni. Když žádná ještě neplatí (všechny mají budoucí
 * datum), vrátí tu nejstarší — stránka nesmí zůstat prázdná.
 */
export const currentVersion = (
  slug: LegalSlug,
  now: Date = new Date()
): LegalDocumentVersion | null => {
  const versions = listVersions(slug)
  const today = pragueToday(now)
  return (
    versions.find((doc) => doc.version <= today) ?? versions[versions.length - 1] ?? null
  )
}

/** Verze, která teprve začne platit (pro upozornění „od … platí nové znění"). */
export const upcomingVersion = (
  slug: LegalSlug,
  now: Date = new Date()
): LegalDocumentVersion | null => {
  const today = pragueToday(now)
  const future = listVersions(slug).filter((doc) => doc.version > today)
  return future[future.length - 1] ?? null
}

/** Verze obchodních podmínek, se kterou zákazník právě nakupuje. */
export const currentTermsVersion = (now: Date = new Date()): string =>
  currentVersion("obchodni-podminky", now)?.version ?? "unknown"

/** „15. 10. 2026" z `2026-10-15`. */
export const formatVersionDate = (version: string): string => {
  const [y, m, d] = version.split("-").map(Number)
  return y && m && d ? `${d}. ${m}. ${y}` : version
}

const PDF_ENTRIES = (manifest as { entries: LegalPdfEntry[] }).entries

/** PDF dané verze, pokud je vygenerované (`pnpm legal:build`). */
export const pdfEntry = (slug: LegalSlug, version: string): LegalPdfEntry | null =>
  PDF_ENTRIES.find((entry) => entry.slug === slug && entry.version === version) ?? null

/** Název souboru PDF pro verzi — sdílí ho generátor i manifest. */
export const pdfFileName = (slug: LegalSlug, version: string): string =>
  `${slug}-${version}.pdf`
