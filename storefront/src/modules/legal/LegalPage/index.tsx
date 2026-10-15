import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import {
  currentVersion,
  formatVersionDate,
  getVersion,
  LEGAL_PATHS,
  listVersions,
  pdfEntry,
  pragueToday,
  upcomingVersion,
} from "@lib/legal/registry"
import type { LegalDocumentVersion, LegalSlug } from "@lib/legal/types"
import LegalDocument, {
  type LegalNotice,
  type LegalPresentation,
  type LegalVersionLink,
} from "@modules/legal/LegalDocument"

/**
 * Stránka právního dokumentu — serverová půlka.
 *
 * Vybere znění z registru (platné, nebo konkrétní verzi pro archivní
 * adresu), spočítá upozornění („od … platí nové znění", „archivní znění"),
 * odkazy na ostatní znění a PDF z manifestu, a klientské `LegalDocument`
 * pošle jen hotová data. CMS se tu nepoužívá vůbec — viz komentář
 * v `LegalDocument`.
 */

/**
 * Dokumenty, které mají stránku pro jednotlivá znění (`<cesta>/<verze>`).
 * Zatím jen obchodní podmínky — jen ty mají archivní znění. Přibude-li
 * archivní znění jinde, přidej sem slug a route `[version]` vedle stránky.
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
  slug: LegalSlug,
  version?: string
): LegalDocumentVersion | null => {
  if (version === undefined) return currentVersion(slug)
  if (!VERSION_PATTERN.test(version)) return null
  return getVersion(slug, version)
}

/** `metadata` stránky dokumentu — název a popis ze znění, archiv bez indexace. */
export const legalMetadata = (slug: LegalSlug, version?: string): Metadata => {
  const doc = resolveLegalVersion(slug, version)
  if (!doc) return { title: "Dokument nenalezen", robots: { index: false, follow: false } }

  if (version === undefined) {
    return { title: doc.title, description: doc.summary }
  }

  // Adresa konkrétního znění je archiv nebo duplikát hlavní stránky — do
  // vyhledávačů patří jen hlavní stránka s platným zněním.
  return {
    title: `${doc.title} — znění od ${formatVersionDate(doc.version)}`,
    description: doc.archived
      ? `Archivní znění dokumentu ${doc.title.toLocaleLowerCase("cs")} platné od ${formatVersionDate(doc.version)}.`
      : doc.summary,
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

export default function LegalPage({
  slug,
  countryCode,
  version,
  presentation,
  supplements,
}: LegalPageProps) {
  const doc = resolveLegalVersion(slug, version)
  if (!doc) notFound()

  const today = pragueToday()
  const current = currentVersion(slug)
  const all = listVersions(slug)
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
    const upcoming = upcomingVersion(slug)
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

  const pdf = doc.pdf ? pdfEntry(slug, doc.version) : null

  return (
    <LegalDocument
      doc={doc}
      presentation={presentation}
      effectiveLabel={effectiveLabelOf(doc, today)}
      countryCode={countryCode}
      notices={notices}
      pdf={pdf ? { href: pdf.url, fileName: pdf.file, bytes: pdf.bytes } : null}
      versions={versions}
      supplements={supplements}
    />
  )
}
