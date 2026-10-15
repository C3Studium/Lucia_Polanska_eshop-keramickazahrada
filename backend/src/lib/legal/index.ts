import manifestJson from "./legal-manifest.json"
import { storefrontBase, storefrontOrigin } from "../storefront-url"

/**
 * Právní dokumenty v backendu — verze, PDF a údaje o prodávající.
 *
 * Zdrojem je `legal-manifest.json`, kopie registru storefrontu, kterou píše
 * `pnpm legal:build` (storefront/scripts/legal-build.mjs) a URL do ní doplňuje
 * `pnpm legal:upload`. Texty dokumentů tu nejsou — backend potřebuje jen
 * vědět, která verze platila kdy, kde leží její PDF a kdo je prodávající
 * (patička e-mailů, potvrzení objednávky). Tím e-maily nemůžou tvrdit nic
 * jiného než PDF a stránky webu.
 *
 * Bez importu Medusa frameworku: čtou to i React Email šablony.
 */

export type LegalSlug =
  | "obchodni-podminky"
  | "reklamacni-rad"
  | "reklamacni-protokol"
  | "odstoupeni-od-smlouvy"
  | "ochrana-osobnich-udaju"
  | "cookies"
  | "doprava-a-platba"

export type LegalManifestPdf = {
  file: string
  /** Trvalá URL v R2, nebo cesta `/legal/<file>` na storefrontu (před nahráním). */
  url: string
  sha256: string
  bytes: number
  /**
   * PDF obsahuje nedoplněné údaje `[[DOPLNIT]]` (pracovní znění) — zákazníkům
   * se nepřikládá ani neodkazuje.
   */
  draft?: boolean
}

export type LegalManifestVersion = {
  /** Verze = datum účinnosti `YYYY-MM-DD`. */
  version: string
  effectiveFrom: string
  title: string
  archived: boolean
  pdf: LegalManifestPdf | null
}

export type LegalManifestDocument = {
  title: string | null
  /** Cesta stránky dokumentu bez prefixu země, např. `/smluvni-podminky`. */
  path: string | null
  versions: LegalManifestVersion[]
}

export type SellerFacts = {
  name: string | null
  address: string | null
  ico: string | null
  email: string | null
  phone: string | null
  web: string | null
  webUrl: string | null
}

export type LegalManifest = {
  schema: number
  seller: SellerFacts
  documents: Partial<Record<LegalSlug, LegalManifestDocument>>
}

export const LEGAL_MANIFEST = manifestJson as unknown as LegalManifest

/** Datum v Praze jako `YYYY-MM-DD` (verze se porovnávají jako řetězce). */
export const pragueDate = (value: Date | string | number = new Date()): string | null => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** „15. 10. 2026" z `2026-10-15` — stejně jako `formatVersionDate()` storefrontu. */
export const formatVersionDate = (version: string): string => {
  const [y, m, d] = String(version).split("-").map(Number)
  return y && m && d ? `${d}. ${m}. ${y}` : version
}

/** Verze dokumentu od nejnovější. */
export const listVersions = (
  slug: LegalSlug,
  manifest: LegalManifest = LEGAL_MANIFEST
): LegalManifestVersion[] =>
  [...(manifest.documents[slug]?.versions ?? [])].sort((a, b) =>
    b.version.localeCompare(a.version)
  )

export const findVersion = (
  slug: LegalSlug,
  version: unknown,
  manifest: LegalManifest = LEGAL_MANIFEST
): LegalManifestVersion | null =>
  typeof version === "string"
    ? listVersions(slug, manifest).find((entry) => entry.version === version) ?? null
    : null

/**
 * Verze platná k danému okamžiku (pražské datum): nejnovější, jejíž datum
 * účinnosti už nastalo. Když žádná ještě neplatila, nejstarší — stejně jako
 * `currentVersion()` v registru storefrontu, ať backend vybere tutéž verzi,
 * kterou web v tu chvíli ukazoval.
 */
export const versionValidAt = (
  slug: LegalSlug,
  at: Date | string | number = new Date(),
  manifest: LegalManifest = LEGAL_MANIFEST
): string | null => {
  const versions = listVersions(slug, manifest)
  const day = pragueDate(at) ?? pragueDate(new Date())!
  return (
    versions.find((entry) => entry.version <= day)?.version ??
    versions[versions.length - 1]?.version ??
    null
  )
}

/** Absolutní URL PDF (R2 nebo storefront), nebo `null`, když není kde ho vzít. */
const absolutePdfUrl = (url: string): string | null => {
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  if (url.startsWith("/")) {
    const origin = storefrontOrigin()
    return origin ? `${origin}${url}` : null
  }
  return null
}

export type LegalPdf = {
  slug: LegalSlug
  version: string
  title: string
  filename: string
  url: string
  sha256: string
  bytes: number
  /** Pracovní znění s `[[DOPLNIT]]` — viz `LegalManifestPdf.draft`. */
  draft: boolean
}

/** PDF dané verze, pokud je vygenerované (`pnpm legal:build`) a dá se na něj odkázat. */
export const legalPdfFor = (
  slug: LegalSlug,
  version: unknown,
  manifest: LegalManifest = LEGAL_MANIFEST
): LegalPdf | null => {
  const entry = findVersion(slug, version, manifest)
  if (!entry?.pdf) {
    return null
  }
  const url = absolutePdfUrl(entry.pdf.url)
  return url
    ? {
        slug,
        version: entry.version,
        title: entry.title,
        filename: entry.pdf.file,
        url,
        sha256: entry.pdf.sha256,
        bytes: entry.pdf.bytes,
        draft: Boolean(entry.pdf.draft),
      }
    : null
}

export const sellerFacts = (manifest: LegalManifest = LEGAL_MANIFEST): SellerFacts => ({
  name: manifest.seller?.name ?? null,
  address: manifest.seller?.address ?? null,
  ico: manifest.seller?.ico ?? null,
  email: manifest.seller?.email ?? null,
  phone: manifest.seller?.phone ?? null,
  web: manifest.seller?.web ?? null,
  webUrl: manifest.seller?.webUrl ?? null,
})

/**
 * „Lucie Polanská · Putim 229, 397 01 Písek · IČO 03441482". Chybějící údaj
 * se vynechá — do e-mailu nikdy nejde zástupný text.
 */
export const sellerIdentityLine = (manifest: LegalManifest = LEGAL_MANIFEST): string => {
  const seller = sellerFacts(manifest)
  return [seller.name, seller.address, seller.ico ? `IČO ${seller.ico}` : null]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ")
}

/** Výchozí cesty, kdyby manifest dokument ještě neznal. */
const FALLBACK_PATHS: Record<LegalSlug, string> = {
  "obchodni-podminky": "/smluvni-podminky",
  "reklamacni-rad": "/reklamacni-rad",
  "reklamacni-protokol": "/reklamacni-protokol",
  "odstoupeni-od-smlouvy": "/odstoupeni-od-smlouvy",
  "ochrana-osobnich-udaju": "/ochrana-osobnich-udaju",
  cookies: "/cookies",
  "doprava-a-platba": "/doprava-a-platba",
}

/** Stránka dokumentu na storefrontu (s prefixem země), `""` bez nastaveného storefrontu. */
export const legalPageUrl = (
  slug: LegalSlug,
  manifest: LegalManifest = LEGAL_MANIFEST
): string => {
  const base = storefrontBase()
  const path = manifest.documents[slug]?.path || FALLBACK_PATHS[slug]
  return base ? `${base}${path}` : ""
}

/**
 * Stránka konkrétní verze obchodních podmínek (`/smluvni-podminky/<verze>`) —
 * znění, podle kterého se objednávka uzavřela.
 */
export const termsVersionUrl = (
  version: string,
  manifest: LegalManifest = LEGAL_MANIFEST
): string => {
  const page = legalPageUrl("obchodni-podminky", manifest)
  return page ? `${page}/${version}` : ""
}
