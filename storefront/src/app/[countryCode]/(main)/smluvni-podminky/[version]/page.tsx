import type { Metadata } from "next"

import LegalPage, { legalMetadata } from "@modules/legal/LegalPage"

/*
 * Konkrétní znění obchodních podmínek podle data účinnosti, např.
 * `/cz/smluvni-podminky/2015-01-01`. Zůstává dostupné kvůli objednávkám,
 * které se podle něj uzavíraly (verze je v `order.metadata.terms_version`
 * a odkazuje na ni potvrzovací e-mail). Neznámá verze → 404 (`LegalPage`
 * volá `notFound()`); archivní znění se neindexuje (`legalMetadata`).
 */
export const revalidate = 3600

type Params = { countryCode: string; version: string }

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const { version } = await props.params
  return legalMetadata("obchodni-podminky", version)
}

export default async function Page(props: { params: Promise<Params> }) {
  const { countryCode, version } = await props.params

  return (
    <LegalPage
      slug="obchodni-podminky"
      countryCode={countryCode}
      version={version}
      presentation={{ code: "01", eyebrow: "Pravidla nákupu", accent: "Bez drobného písma." }}
    />
  )
}
