import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/*
 * Obchodní podmínky z registru (`@lib/legal`), ne z CMS. Platné znění se
 * vybírá podle dnešního data (Praha), proto se stránka přepočítává — nové
 * znění naskočí v den účinnosti i bez nového nasazení. Starší znění žijí na
 * `/smluvni-podminky/<verze>` (viz `[version]/page.tsx`).
 */
export const revalidate = 3600

export function generateMetadata(): Metadata {
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
