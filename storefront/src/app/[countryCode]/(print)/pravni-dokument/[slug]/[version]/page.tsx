import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLegalFacts } from "@lib/data/legal-facts"
import { getPublishedLegalRegistry } from "@lib/data/legal-registry"
import { formatVersionDate, LEGAL_PATHS, type LegalRegistry } from "@lib/legal/registry"
import type { LegalDocumentVersion, LegalSlug } from "@lib/legal/types"
import LegalPrintDocument from "@modules/legal-print/LegalPrintDocument"

/**
 * Tisková podoba jedné verze právního dokumentu — předloha pro PDF
 * (`pnpm legal:build` ji otevře v Chromiu a uloží jako A4).
 *
 * `/cz/pravni-dokument/obchodni-podminky/2026-10-15`. Neznámý dokument nebo
 * verze = 404, nic se nedohledává ani nenahrazuje jinou verzí.
 *
 * Jen PUBLIKOVANÉ znění (`getPublishedLegalRegistry`) — PDF se nesmí
 * vytisknout z konceptu ve Studiu, ani kdyby tiskl někdo se zapnutým
 * náhledem. Fakty `registry.factsFor`: u vydané verze otisk z manifestu,
 * jinak živé z administrace — tytéž, se kterými `/api/legal/versions`
 * počítá otisk zdroje.
 */

type Params = Promise<{ countryCode: string; slug: string; version: string }>

const isLegalSlug = (value: string): value is LegalSlug =>
  Object.prototype.hasOwnProperty.call(LEGAL_PATHS, value)

const resolveDocument = (
  registry: LegalRegistry,
  slug: string,
  version: string
): LegalDocumentVersion | null =>
  isLegalSlug(slug) && /^\d{4}-\d{2}-\d{2}$/.test(version) ? registry.getVersion(slug, version) : null

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, version } = await params
  const doc = resolveDocument(await getPublishedLegalRegistry(), slug, version)
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
  const [registry, liveFacts] = await Promise.all([getPublishedLegalRegistry(), getLegalFacts()])
  const doc = resolveDocument(registry, slug, version)

  if (!doc) {
    notFound()
  }

  return <LegalPrintDocument doc={doc} facts={registry.factsFor(doc.slug, doc.version, liveFacts)} />
}
