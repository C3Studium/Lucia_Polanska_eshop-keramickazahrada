import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/* Zásady ochrany osobních údajů — znění z registru (`@lib/legal`), ne z CMS. */
export const revalidate = 3600

export function generateMetadata(): Metadata {
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
