import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/*
 * Obchodní podmínky ze sloučeného registru (Studio + kopie v repu, viz
 * `@lib/legal/registry`). Platné znění se
 * vybírá podle dnešního data (Praha), proto se stránka přepočítává — nové
 * znění naskočí v den účinnosti i bez nového nasazení. Starší znění žijí na
 * `/smluvni-podminky/<verze>` (viz `[version]/page.tsx`).
 */
export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata("obchodni-podminky")
}

export default async function Page(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  return (
    <LegalPage
      slug="obchodni-podminky"
      countryCode={countryCode}
      presentation={{ code: "01", eyebrow: "Pravidla nákupu", accent: "Bez drobného písma." }}
    />
  )
}
