import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { getLegalFacts } from "@lib/data/legal-facts"
import { getLegalRegistry } from "@lib/data/legal-registry"
import { getFiles } from "@lib/data/site-copy"
import { isPublishedPdfUrl } from "@lib/legal/pdf-published"
import {
  formatVersionDate,
  LEGAL_PATHS,
  pragueToday,
  type LegalRegistry,
} from "@lib/legal/registry"
import type { LegalDocumentVersion, LegalSlug } from "@lib/legal/types"
import { printedText } from "@modules/legal-print/meta"
import LegalDocument, {
  type LegalNotice,
  type LegalPresentation,
  type LegalVersionLink,
} from "@modules/legal/LegalDocument"

/**
 * Stránka právního dokumentu — serverová půlka.
 *
 * Vybere znění ze sloučeného registru (`getLegalRegistry()`: kopie v repu +
 * Studio + manifest PDF — platné, nebo konkrétní verzi pro archivní adresu),
 * spočítá upozornění („od … platí nové znění", „archivní znění"), odkazy na
 * ostatní znění, PDF z manifestu a fakty, se kterými se znění vykreslí (u
 * vydaného otisk z manifestu, jinak živé z administrace), a klientskému
 * `LegalDocument` pošle jen hotová data.
 *
 * Znění píše Lucie ve Studiu (typ „Právní dokumenty"); vydané znění (se
 * zveřejněným PDF) se bere jen z repa — viz `@lib/legal/registry`. Ze Studia
 * sem chodí ještě „Další soubory ke stažení" (typ `soubor`), odděleně od
 * oficiálního PDF.
 */

/**
 * Dokumenty, které mají stránku pro jednotlivá znění (`<cesta>/<verze>`).
 * Zatím jen obchodní podmínky — jen ty mají archivní znění. Přibude-li
 * archivní znění jinde, přidej sem slug a route `[version]` vedle stránky
 * (a `paths` v `legalPages` ve `valecms.config.ts`).
 */
export const VERSIONED_SLUGS: readonly LegalSlug[] = ["obchodni-podminky"]

export const versionPath = (slug: LegalSlug, version: string): string | null =>
  VERSIONED_SLUGS.indexOf(slug) !== -1 ? `${LEGAL_PATHS[slug]}/${version}` : null

const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Den před datem verze (`2026-10-15` → „14. 10. 2026") — konec platnosti předchozí. */
const dayBefore = (version: string): string => {
  const [y, m, d] = version.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - 1)
  return formatVersionDate(date.toISOString().slice(0, 10))
}

const effectiveLabelOf = (doc: LegalDocumentVersion, today: string) =>
  `${doc.version <= today ? "Platné od" : "Účinné od"} ${formatVersionDate(doc.version)}`

/** Znění pro stránku: konkrétní verze, nebo ta, která dnes platí. */
export const resolveLegalVersion = (
  registry: LegalRegistry,
  slug: LegalSlug,
  version?: string
): LegalDocumentVersion | null => {
  if (version === undefined) return registry.currentVersion(slug)
  if (!VERSION_PATTERN.test(version)) return null
  return registry.getVersion(slug, version)
}

/**
 * `metadata` stránky dokumentu — název a popis ze znění, archiv bez indexace.
 *
 * Název i úvod můžou nést značku (`{{údaj}}`, `**tučně**`, odkaz) — do
 * `<title>` a meta popisu jde jejich čistý text s dosazenými údaji (týmiž, se
 * kterými se znění vykreslí), ne syrová značka.
 */
export const legalMetadata = async (slug: LegalSlug, version?: string): Promise<Metadata> => {
  const [registry, liveFacts] = await Promise.all([getLegalRegistry(), getLegalFacts()])
  const doc = resolveLegalVersion(registry, slug, version)
  if (!doc) return { title: "Dokument nenalezen", robots: { index: false, follow: false } }

  const facts = registry.factsFor(doc.slug, doc.version, liveFacts)
  const title = printedText(doc.title, facts)
  const summary = doc.summary ? printedText(doc.summary, facts) : undefined

  if (version === undefined) {
    return { title, description: summary }
  }

  // Adresa konkrétního znění je archiv nebo duplikát hlavní stránky — do
  // vyhledávačů patří jen hlavní stránka s platným zněním.
  return {
    title: `${title} — znění od ${formatVersionDate(doc.version)}`,
    description: doc.archived
      ? `Archivní znění dokumentu ${title.toLocaleLowerCase("cs")} platné od ${formatVersionDate(doc.version)}.`
      : summary,
    robots: { index: false, follow: true },
  }
}

type LegalPageProps = {
  slug: LegalSlug
  countryCode: string
  /** Konkrétní znění (archivní adresa); bez něj platné znění. */
  version?: string
  presentation: LegalPresentation
  supplements?: Record<string, ReactNode>
}

export default async function LegalPage({
  slug,
  countryCode,
  version,
  presentation,
  supplements,
}: LegalPageProps) {
  // `stranka` souboru ve Studiu = cesta dokumentu bez lomítka (`smluvni-podminky`).
  const [registry, liveFacts, files] = await Promise.all([
    getLegalRegistry(),
    getLegalFacts(),
    getFiles(LEGAL_PATHS[slug].slice(1)),
  ])
  const doc = resolveLegalVersion(registry, slug, version)
  if (!doc) notFound()

  const today = pragueToday()
  const current = registry.currentVersion(slug)
  const all = registry.listVersions(slug)
  const href = (path: string) => `/${countryCode}${path}`
  const mainHref = href(LEGAL_PATHS[slug])

  const notices: LegalNotice[] = []

  if (current && doc.version !== current.version) {
    if (doc.version < current.version) {
      // Archiv: platilo od své verze do dne před další novější verzí.
      const newer = all
        .filter((other) => other.version > doc.version)
        .sort((a, b) => a.version.localeCompare(b.version))[0]
      notices.push({
        tone: "archive",
        text: `Toto je archivní znění platné od ${formatVersionDate(doc.version)}${
          newer ? ` do ${dayBefore(newer.version)}` : ""
        }. Řídí se jím smlouvy uzavřené v tomto období.`,
        link: { href: mainHref, label: "Přejít na platné znění." },
      })
    } else {
      notices.push({
        tone: "future",
        text: `Toto znění začne platit ${formatVersionDate(doc.version)}. Do té doby platí dosavadní znění.`,
        link: { href: mainHref, label: "Přejít na platné znění." },
      })
    }
  } else {
    const upcoming = registry.upcomingVersion(slug)
    if (upcoming && upcoming.version !== doc.version) {
      const upcomingPath = versionPath(slug, upcoming.version)
      notices.push({
        tone: "upcoming",
        text: `Od ${formatVersionDate(upcoming.version)} platí nové znění.`,
        link: upcomingPath
          ? { href: href(upcomingPath), label: "Přečíst nové znění." }
          : undefined,
      })
    }
  }

  // Ostatní znění téhož dokumentu — jen kde pro ně existuje stránka.
  const versions: LegalVersionLink[] = all
    .filter((other) => other.version !== doc.version)
    .map((other): LegalVersionLink | null => {
      const isCurrent = current?.version === other.version
      const path = isCurrent ? LEGAL_PATHS[slug] : versionPath(slug, other.version)
      if (!path) return null
      return {
        href: href(path),
        title: `${other.title} — znění od ${formatVersionDate(other.version)}`,
        description: isCurrent
          ? "Platné znění"
          : other.version > today
            ? "Připravované znění"
            : "Archivní znění pro starší objednávky",
      }
    })
    .filter((link): link is LegalVersionLink => link !== null)

  // Jen zveřejněné PDF (nahrané v úložišti) — pracovní znění s [[DOPLNIT]]
  // se nenabízí ke stažení, stejně jako v patičce a v e-mailech. Místo něj
  // zůstane tlačítko tisku stránky.
  const entry = doc.pdf ? registry.pdfEntry(slug, doc.version) : null
  const pdf = entry && isPublishedPdfUrl(entry.url) ? entry : null

  return (
    <LegalDocument
      doc={doc}
      facts={registry.factsFor(doc.slug, doc.version, liveFacts)}
      presentation={presentation}
      effectiveLabel={effectiveLabelOf(doc, today)}
      countryCode={countryCode}
      notices={notices}
      pdf={pdf ? { href: pdf.url, fileName: pdf.file, bytes: pdf.bytes } : null}
      versions={versions}
      files={files.map((file) => ({
        href: file.url,
        title: file.nazev,
        description: file.popis || undefined,
        bytes: file.size || undefined,
        mime: file.mime,
      }))}
      supplements={supplements}
    />
  )
}
