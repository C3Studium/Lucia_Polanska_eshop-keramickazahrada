import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/*
 * Používání cookies — znění z registru, tabulky ze soupisu
 * `@lib/legal/cookies-inventory` (udržuje ho lišta souhlasu). Kdo píše znění
 * ve Studiu, musí tabulky převzít — soupis se do CMS nepromítá sám.
 */
export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata("cookies")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  return (
    <LegalPage
      slug="cookies"
      countryCode={countryCode}
      presentation={{ code: "DATA · 05", eyebrow: "Cookies", accent: "Krátce a jasně." }}
    />
  )
}
