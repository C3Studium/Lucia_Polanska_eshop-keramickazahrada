import { ALL_VERSIONS, MODULE_VERSIONS } from "./documents"
import { mergeFacts, type LegalFacts } from "./facts"
import manifest from "./pdf-manifest.json"
import { isPublishedPdfUrl } from "./pdf-published"
import type { LegalDocumentVersion, LegalPdfEntry, LegalSlug } from "./types"

/**
 * Registr právních dokumentů — jediný zdroj pro stránky, tisk do PDF,
 * checkout (verze OP k objednávce) i e-maily (přes `pdf-manifest.json`,
 * jehož kopii má backend).
 *
 * Verze = datum účinnosti. „Platná" je nejnovější verze, jejíž datum už
 * nastalo (pražské datum); novější s budoucím datem je „připravovaná".
 *
 * ## Odkud se znění bere (docs/cms/00-plan.md, C)
 *
 * Znění píše Lucie ve Studiu (typ „Právní dokumenty"); v repu leží kopie —
 * TS moduly `./documents/<slug>/<verze>.ts` a otisky z CMS
 * `./documents/snapshots/*.json`, které zapisuje `pnpm legal:build`.
 * `createLegalRegistry` je slučuje (klíč `slug@verze`):
 *
 * - **Vydané znění** (PDF v manifestu se zveřejněnou https adresou) se bere
 *   VŽDY z repa a s fakty z otisku v manifestu (`entry.facts`) — k vydanému
 *   PDF se váže uzavřená smlouva, nic v CMS ho nesmí změnit.
 * - Jinak má přednost CMS (v náhledu Studia koncept), verze jen v CMS se
 *   přidají, a bez CMS platí kopie z repa.
 *
 * Tenhle modul je čistý (bez CMS, bez Nextu): čtení z CMS dělá serverový
 * `@lib/data/legal-registry` (`getLegalRegistry()`), který sem podá už
 * převedené a zkontrolované verze. Stránky, checkout i e-maily čtou jen to.
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

/** „15. 10. 2026" z `2026-10-15`. */
export const formatVersionDate = (version: string): string => {
  const [y, m, d] = version.split("-").map(Number)
  return y && m && d ? `${d}. ${m}. ${y}` : version
}

/** Název souboru PDF pro verzi — sdílí ho generátor i manifest. */
export const pdfFileName = (slug: LegalSlug, version: string): string =>
  `${slug}-${version}.pdf`

/** Záznamy `pdf-manifest.json` (plní `pnpm legal:build`, URL doplňuje `pnpm legal:upload`). */
// Přes `unknown`: typ odvozený z JSONu má u `facts` sjednocení objektů s různými
// klíči, které TypeScript s `Record<string, …>` neporovná, i když tvar sedí.
export const PDF_ENTRIES: LegalPdfEntry[] = (manifest as unknown as { entries: LegalPdfEntry[] })
  .entries

/** Odkud znění verze pochází: kopie v repu, nebo dokument ze Studia. */
export type LegalVersionSource = "repo" | "cms"

export type LegalRegistry = {
  /** Všechny verze všech dokumentů (sloučené). */
  all: () => LegalDocumentVersion[]
  /** Všechny verze dokumentu, od nejnovější. */
  listVersions: (slug: LegalSlug) => LegalDocumentVersion[]
  getVersion: (slug: LegalSlug, version: string) => LegalDocumentVersion | null
  /**
   * Platná verze k danému dni. Když žádná ještě neplatí (všechny mají budoucí
   * datum), vrátí tu nejstarší — stránka nesmí zůstat prázdná.
   */
  currentVersion: (slug: LegalSlug, now?: Date) => LegalDocumentVersion | null
  /** Verze, která teprve začne platit (pro upozornění „od … platí nové znění"). */
  upcomingVersion: (slug: LegalSlug, now?: Date) => LegalDocumentVersion | null
  /** Verze obchodních podmínek, se kterou zákazník právě nakupuje. */
  currentTermsVersion: (now?: Date) => string
  /** PDF dané verze, pokud je vygenerované (`pnpm legal:build`). */
  pdfEntry: (slug: LegalSlug, version: string) => LegalPdfEntry | null
  /** Vydané znění = PDF zveřejněné v úložišti (https). Takové se nesmí měnit. */
  isLocked: (slug: LegalSlug, version: string) => boolean
  /**
   * Fakty, se kterými se verze vykresluje: u vydané verze otisk z manifestu
   * (hodnoty v době vydání, přes ně živé jen u klíčů, které otisk nemá), jinak
   * živé fakty z administrace obchodu.
   */
  factsFor: (slug: LegalSlug, version: string, live: LegalFacts) => LegalFacts
  sourceOf: (slug: LegalSlug, version: string) => LegalVersionSource | null
  /** Kopie verze v repu (TS modul / otisk), bez ohledu na CMS. */
  repoVersion: (slug: LegalSlug, version: string) => LegalDocumentVersion | null
  /**
   * Znění z CMS pod tímhle klíčem, i když se nepoužívá (vydaná verze) —
   * `legal:build` podle něj upozorní, že Studio drží jiný text než vydaný.
   */
  cmsVersion: (slug: LegalSlug, version: string) => LegalDocumentVersion | null
  /**
   * Kolik znění přišlo ze Studia: `read` platných (i nepoužitých — vydaná),
   * `used` těch, která na webu opravdu platí, `skipped` neplatných (zahozených).
   * `legal:build` je vypíše, aby nečitelné CMS nevypadalo jako prázdné.
   */
  cmsStats: () => { read: number; used: number; skipped: number }
}

const keyOf = (slug: string, version: string) => `${slug}@${version}`

/**
 * Kapitoly, jejichž obsah drží KÓD, i když znění přišlo ze Studia.
 *
 * Tabulky v „Používání cookies" (kotva `seznam`) skládá TS modul ze soupisu
 * `cookies-inventory.ts`, který se mění spolu s lištou souhlasu. Kopie
 * v CMS by je zmrazila v podobě z doby, kdy ji někdo uložil — a stránka by
 * začala tvrdit něco jiného, než web dělá. Proto se obsah té kapitoly bere
 * vždy z TS modulu (téže verze, jinak nejnovějšího), text okolo ze Studia.
 * Studio to říká v popisu typu.
 */
const CODE_OWNED_SECTIONS: Partial<Record<LegalSlug, string[]>> = {
  cookies: ["seznam"],
}

const withCodeOwnedSections = (
  doc: LegalDocumentVersion,
  repo: LegalDocumentVersion[]
): LegalDocumentVersion => {
  const ids = CODE_OWNED_SECTIONS[doc.slug]
  if (!ids?.length) return doc
  const source =
    repo.find((other) => other.slug === doc.slug && other.version === doc.version) ??
    repo
      .filter((other) => other.slug === doc.slug)
      .sort((a, b) => b.version.localeCompare(a.version))[0]
  if (!source) return doc
  return {
    ...doc,
    sections: doc.sections.map((section) => {
      if (ids.indexOf(section.id) === -1) return section
      const owned = source.sections.find((candidate) => candidate.id === section.id)
      return owned ? { ...section, blocks: owned.blocks } : section
    }),
  }
}

/**
 * Sloučený registr. `cms` = verze ze Studia, už převedené a zkontrolované
 * (`fromCmsBody`); na pořadí nezáleží, duplicitní klíč vyřeší volající.
 */
export const createLegalRegistry = ({
  repo = ALL_VERSIONS,
  modules = MODULE_VERSIONS,
  cms = [],
  cmsSkipped = 0,
  entries = PDF_ENTRIES,
}: {
  /** Kopie v repu: TS moduly a přes ně otisky (`documents/index.ts`). */
  repo?: LegalDocumentVersion[]
  /** Jen TS moduly — zdroj kapitol, které drží kód (`CODE_OWNED_SECTIONS`). */
  modules?: LegalDocumentVersion[]
  cms?: LegalDocumentVersion[]
  /** Kolik dokumentů ze Studia převod odmítl (`@lib/data/legal-registry`). */
  cmsSkipped?: number
  entries?: LegalPdfEntry[]
} = {}): LegalRegistry => {
  const pdfByKey = new Map(entries.map((entry) => [keyOf(entry.slug, entry.version), entry]))
  const locked = (key: string) => {
    const entry = pdfByKey.get(key)
    return Boolean(entry && isPublishedPdfUrl(entry.url))
  }

  const repoByKey = new Map(repo.map((doc) => [keyOf(doc.slug, doc.version), doc]))
  const merged = new Map<string, { doc: LegalDocumentVersion; source: LegalVersionSource }>()
  // Kapitoly z kódu i u otisku v repu (otisk je zmrazená kopie z CMS) — ale
  // ne u vydaného znění: to je neměnné včetně tabulek, se kterými vyšlo.
  repoByKey.forEach((doc, key) => {
    merged.set(key, { doc: locked(key) ? doc : withCodeOwnedSections(doc, modules), source: "repo" })
  })
  for (const doc of cms) {
    const key = keyOf(doc.slug, doc.version)
    // Vydané znění: CMS se ignoruje, platí otisk v repu. Bez otisku (nemělo by
    // nastat — `legal:build` ho zapíše dřív, než se PDF nahraje) zůstane
    // znění z CMS, aby stránka nezmizela; zámek Studia ho stejně nepustí měnit.
    if (locked(key) && repoByKey.has(key)) continue
    merged.set(key, { doc: withCodeOwnedSections(doc, modules), source: "cms" })
  }

  const all = Array.from(merged.values()).map((entry) => entry.doc)

  const listVersions = (slug: LegalSlug) =>
    all.filter((doc) => doc.slug === slug).sort((a, b) => b.version.localeCompare(a.version))

  const currentVersion = (slug: LegalSlug, now: Date = new Date()) => {
    const versions = listVersions(slug)
    const today = pragueToday(now)
    return versions.find((doc) => doc.version <= today) ?? versions[versions.length - 1] ?? null
  }

  return {
    all: () => [...all],
    listVersions,
    getVersion: (slug, version) => merged.get(keyOf(slug, version))?.doc ?? null,
    currentVersion,
    upcomingVersion: (slug, now = new Date()) => {
      const today = pragueToday(now)
      const future = listVersions(slug).filter((doc) => doc.version > today)
      return future[future.length - 1] ?? null
    },
    currentTermsVersion: (now = new Date()) =>
      currentVersion("obchodni-podminky", now)?.version ?? "unknown",
    pdfEntry: (slug, version) => pdfByKey.get(keyOf(slug, version)) ?? null,
    isLocked: (slug, version) => locked(keyOf(slug, version)),
    factsFor: (slug, version, live) => {
      const entry = pdfByKey.get(keyOf(slug, version))
      if (!entry || !isPublishedPdfUrl(entry.url) || !entry.facts) return live
      return mergeFacts(entry.facts, live)
    },
    sourceOf: (slug, version) => merged.get(keyOf(slug, version))?.source ?? null,
    repoVersion: (slug, version) => repoByKey.get(keyOf(slug, version)) ?? null,
    cmsVersion: (slug, version) =>
      cms.find((doc) => doc.slug === slug && doc.version === version) ?? null,
    cmsStats: () => ({
      read: cms.length,
      used: Array.from(merged.values()).filter((entry) => entry.source === "cms").length,
      skipped: cmsSkipped,
    }),
  }
}
