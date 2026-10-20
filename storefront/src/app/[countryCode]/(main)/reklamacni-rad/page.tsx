import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/*
 * Reklamační řád — pravidla reklamací jako samostatný dokument
 * (LEGAL_AUDIT.md §4, §6). Praktický návod a formulář je na
 * `/reklamacni-protokol`. Znění ze sloučeného registru (Studio + repo).
 */
export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata("reklamacni-rad")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  return (
    <LegalPage
      slug="reklamacni-rad"
      countryCode={countryCode}
      presentation={{ code: "07", eyebrow: "Reklamace · pravidla", accent: "Co platí, když je vada." }}
    />
  )
}
