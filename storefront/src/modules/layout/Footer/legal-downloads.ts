import manifest from "@lib/legal/pdf-manifest.json"
import { isPublishedPdfUrl } from "@lib/legal/pdf-published"
import type { LegalPdfEntry, LegalSlug } from "@lib/legal/types"

/**
 * PDF právních dokumentů pro patičku („Ke stažení").
 *
 * Čte jen `pdf-manifest.json` (plní `pnpm legal:build` / `legal:upload`), ne
 * registr: patička je klientská komponenta na každé stránce a registr by do
 * prohlížeče zatáhl plné znění všech dokumentů. Archivní verze se nenabízí
 * (váží se jen ke starším objednávkám); z ostatních vyhrává nejnovější, jejíž
 * datum už nastalo, jinak nejbližší připravovaná — jako `currentVersion()`
 * v `@lib/legal/registry`.
 *
 * Nabízí se JEN zveřejněné PDF: takové, jehož `url` v manifestu je absolutní
 * https adresa (`isPublishedPdfUrl`). Tu tam zapíše `pnpm legal:upload`,
 * a ten nahrává jen finální znění; pracovní PDF (s `[[DOPLNIT]]`) mají jen
 * místní cestu `/legal/…` a zákazníkovi se nedávají. Rozhoduje se až nad
 * platnou verzí — starší zveřejněné PDF nesmí zastoupit novější znění, které
 * ještě zveřejněné není.
 */

const DOWNLOADS: { slug: LegalSlug; label: string }[] = [
  { slug: "obchodni-podminky", label: "Obchodní podmínky" },
  { slug: "reklamacni-rad", label: "Reklamační řád" },
  { slug: "odstoupeni-od-smlouvy", label: "Poučení a formulář pro odstoupení" },
  { slug: "reklamacni-protokol", label: "Reklamační protokol" },
  { slug: "ochrana-osobnich-udaju", label: "Zásady ochrany osobních údajů" },
]

const ENTRIES = (manifest as { entries: LegalPdfEntry[] }).entries

/** Pražské datum `YYYY-MM-DD` — stejně jako `pragueToday()` v registru. */
const pragueToday = (now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

export type LegalDownload = {
  slug: LegalSlug
  label: string
  url: string
  version: string
  bytes: number
}

/**
 * Aktuální PDF každého dokumentu, který v manifestu je a je zveřejněné.
 * Chybějící nebo pracovní se vynechá.
 */
export const currentLegalDownloads = (now: Date = new Date()): LegalDownload[] => {
  const today = pragueToday(now)
  const downloads: LegalDownload[] = []
  for (const { slug, label } of DOWNLOADS) {
    const versions = ENTRIES.filter((entry) => entry.slug === slug && !entry.archived).sort(
      (a, b) => b.version.localeCompare(a.version)
    )
    const entry = versions.find((item) => item.version <= today) ?? versions[versions.length - 1]
    if (entry && isPublishedPdfUrl(entry.url)) {
      downloads.push({ slug, label, url: entry.url, version: entry.version, bytes: entry.bytes })
    }
  }
  return downloads
}

/** „180 kB" — velikost pro rozhodnutí, jestli stahovat na mobilních datech. */
export const formatPdfSize = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
