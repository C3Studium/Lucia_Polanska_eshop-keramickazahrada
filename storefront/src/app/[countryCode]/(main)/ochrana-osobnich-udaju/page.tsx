import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/* Zásady ochrany osobních údajů — znění ze sloučeného registru (Studio + repo, `@lib/legal/registry`). */
export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata("ochrana-osobnich-udaju")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  return (
    <LegalPage
      slug="ochrana-osobnich-udaju"
      countryCode={countryCode}
      presentation={{ code: "GDPR · 02", eyebrow: "Soukromí", accent: "Vaše údaje zůstávají vaše." }}
    />
  )
}
