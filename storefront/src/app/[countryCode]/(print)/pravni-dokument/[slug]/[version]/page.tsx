import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatVersionDate, getVersion, LEGAL_PATHS } from "@lib/legal/registry"
import type { LegalDocumentVersion, LegalSlug } from "@lib/legal/types"
import LegalPrintDocument from "@modules/legal-print/LegalPrintDocument"

/**
 * Tisková podoba jedné verze právního dokumentu — předloha pro PDF
 * (`pnpm legal:build` ji otevře v Chromiu a uloží jako A4).
 *
 * `/cz/pravni-dokument/obchodni-podminky/2026-10-15`. Neznámý dokument nebo
 * verze = 404, nic se nedohledává ani nenahrazuje jinou verzí.
 */

type Params = Promise<{ countryCode: string; slug: string; version: string }>

const isLegalSlug = (value: string): value is LegalSlug =>
  Object.prototype.hasOwnProperty.call(LEGAL_PATHS, value)

const resolveDocument = (slug: string, version: string): LegalDocumentVersion | null =>
  isLegalSlug(slug) && /^\d{4}-\d{2}-\d{2}$/.test(version) ? getVersion(slug, version) : null

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, version } = await params
  const doc = resolveDocument(slug, version)
  // Titulek stránky = název PDF v prohlížeči i v metadatech souboru.
  return {
    title: doc
      ? { absolute: `${doc.title} — znění platné od ${formatVersionDate(doc.version)}` }
      : { absolute: "Dokument nenalezen" },
    robots: { index: false, follow: false },
  }
}

export default async function LegalPrintPage({ params }: { params: Params }) {
  const { slug, version } = await params
  const doc = resolveDocument(slug, version)

  if (!doc) {
    notFound()
  }

  return <LegalPrintDocument doc={doc} />
}
