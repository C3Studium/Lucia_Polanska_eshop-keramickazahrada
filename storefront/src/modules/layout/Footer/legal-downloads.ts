import { isPublishedPdfUrl } from "@lib/legal/pdf-published"
import type { LegalRegistry } from "@lib/legal/registry"
import type { LegalSlug } from "@lib/legal/types"

/**
 * PDF právních dokumentů pro patičku („Ke stažení").
 *
 * Počítá se na SERVERU nad sloučeným registrem (repo + Studio + manifest PDF,
 * `getLegalRegistry()`) a patička — klientská komponenta na každé stránce —
 * dostane jen hotový seznam (`./data.ts` → prop `downloads`). Registr do
 * prohlížeče nepatří, nese plné znění všech dokumentů. Dřív se tu četl
 * jen `pdf-manifest.json`; to přestalo stačit, jakmile verze mohou vznikat ve
 * Studiu: novější znění, které je jen v CMS, by manifest neznal a patička by
 * dál nabízela starší PDF.
 *
 * Archivní verze se nenabízí (váží se jen ke starším objednávkám). Za každý
 * dokument jde PDF jen té verze, která dnes platí (`currentVersion` — jinak
 * nejbližší připravovaná), a jen ZVEŘEJNĚNÉ: s absolutní https adresou
 * v manifestu (`isPublishedPdfUrl`). Tu tam zapíše `pnpm legal:upload`,
 * a ten nahrává jen finální znění; pracovní PDF (s `[[DOPLNIT]]`) mají jen
 * místní cestu `/legal/…` a zákazníkovi se nedávají. Starší zveřejněné PDF
 * nesmí zastoupit novější znění, které ještě zveřejněné není.
 *
 * Tenhle soubor je bez serverových závislostí (jen typy), takže z něj patička
 * smí brát `formatPdfSize`.
 */

const DOWNLOADS: { slug: LegalSlug; label: string }[] = [
  { slug: "obchodni-podminky", label: "Obchodní podmínky" },
  { slug: "reklamacni-rad", label: "Reklamační řád" },
  { slug: "odstoupeni-od-smlouvy", label: "Poučení a formulář pro odstoupení" },
  { slug: "reklamacni-protokol", label: "Reklamační protokol" },
  { slug: "ochrana-osobnich-udaju", label: "Zásady ochrany osobních údajů" },
]

export type LegalDownload = {
  slug: LegalSlug
  label: string
  url: string
  version: string
  bytes: number
}

/** Soubor ze Studia (typ `soubor`, „Kde se nabízí: Patička webu"). */
export type FooterFile = {
  label: string
  url: string
  description: string
  mime: string
  bytes: number
}

export type FooterDownloads = {
  legal: LegalDownload[]
  files: FooterFile[]
}

/**
 * Aktuální PDF každého dokumentu, které je zveřejněné. Chybějící nebo
 * pracovní se vynechá.
 */
export const currentLegalDownloads = (
  registry: Pick<LegalRegistry, "currentVersion" | "pdfEntry">,
  now: Date = new Date()
): LegalDownload[] => {
  const downloads: LegalDownload[] = []
  for (const { slug, label } of DOWNLOADS) {
    const doc = registry.currentVersion(slug, now)
    if (!doc || doc.archived || !doc.pdf) continue
    const entry = registry.pdfEntry(slug, doc.version)
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
