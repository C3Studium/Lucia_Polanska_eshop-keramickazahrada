import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/*
 * Odstoupení od smlouvy — doslovné poučení a formulář podle NV 29/2023 Sb.
 * (ve znění NV 66/2026 Sb.) plus návod k online odstoupení. Znění z registru,
 * ne z CMS. Dřívější vzor oznámení přímo v této stránce (s prohlášením, že
 * zboží „není zbožím uvedeným v § 1837") je pryč.
 */
export const revalidate = 3600

export function generateMetadata(): Metadata {
  return legalMetadata("odstoupeni-od-smlouvy")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  return (
    <LegalPage
      slug="odstoupeni-od-smlouvy"
      countryCode={countryCode}
      presentation={{ code: "FORM · 03", eyebrow: "Vrácení zboží", accent: "Krok za krokem." }}
    />
  )
}
