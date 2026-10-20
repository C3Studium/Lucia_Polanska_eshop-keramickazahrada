import type { Metadata } from "next"

import { getLegalRegistry } from "@lib/data/legal-registry"
import { isPublishedPdfUrl } from "@lib/legal/pdf-published"
import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

import ProtocolDownload from "./download"

/*
 * Reklamační protokol — návod a formulář k tisku, znění ze sloučeného registru
 * (Studio + repo; vydané znění jen z repa).
 * U kapitoly „Reklamační formulář" je tlačítko: PDF z manifestu, jakmile ho
 * `pnpm legal:build` vygeneruje, do té doby tisk stránky.
 */
export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata("reklamacni-protokol")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const registry = await getLegalRegistry()
  const doc = registry.currentVersion("reklamacni-protokol")
  const entry = doc ? registry.pdfEntry("reklamacni-protokol", doc.version) : null
  // Jen zveřejněné PDF (viz `lib/legal/pdf-published`), jinak tisk stránky.
  const pdf = entry && isPublishedPdfUrl(entry.url) ? entry : null

  return (
    <LegalPage
      slug="reklamacni-protokol"
      countryCode={countryCode}
      presentation={{ code: "06", eyebrow: "Reklamace · postup", accent: "Když něco není v pořádku." }}
      supplements={{ formular: <ProtocolDownload pdfHref={pdf?.url ?? null} /> }}
    />
  )
}
