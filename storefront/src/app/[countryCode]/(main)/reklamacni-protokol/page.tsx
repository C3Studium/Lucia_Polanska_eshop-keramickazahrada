import type { Metadata } from "next"

import { currentVersion, pdfEntry } from "@lib/legal/registry"
import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

import ProtocolDownload from "./download"

/*
 * Reklamační protokol — návod a formulář k tisku, znění z registru (ne z CMS).
 * U kapitoly „Reklamační formulář" je tlačítko: PDF z manifestu, jakmile ho
 * `pnpm legal:build` vygeneruje, do té doby tisk stránky.
 */
export const revalidate = 3600

export function generateMetadata(): Metadata {
  return legalMetadata("reklamacni-protokol")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const doc = currentVersion("reklamacni-protokol")
  const pdf = doc ? pdfEntry("reklamacni-protokol", doc.version) : null

  return (
    <LegalPage
      slug="reklamacni-protokol"
      countryCode={countryCode}
      presentation={{ code: "06", eyebrow: "Reklamace · postup", accent: "Když něco není v pořádku." }}
      supplements={{ formular: <ProtocolDownload pdfHref={pdf?.url ?? null} /> }}
    />
  )
}
