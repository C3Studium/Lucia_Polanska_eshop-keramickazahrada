import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"
import ShippingPrices from "@modules/legal/ShippingPrices"

/*
 * Doprava a platba — text z registru (ne z CMS), ceny NE z textu: kapitola
 * `cenik` dostane živý ceník z backendu (`GET /store/legal/shipping-prices`),
 * tedy totéž, co nabídne pokladna. Bez backendu se ukáže odkaz do košíku.
 */
export const revalidate = 3600

export function generateMetadata(): Metadata {
  return legalMetadata("doprava-a-platba")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  return (
    <LegalPage
      slug="doprava-a-platba"
      countryCode={countryCode}
      presentation={{ code: "SERVIS · 04", eyebrow: "Od ateliéru k vám", accent: "Zabalíme a pošleme." }}
      supplements={{ cenik: <ShippingPrices countryCode={countryCode} /> }}
    />
  )
}
