import { Metadata } from "next"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import { getPageContentFull } from "@lib/data/site-copy"
import AboutPageExperience from "@modules/omne/page"

export const metadata: Metadata = {
  title: "O mně — Lucie Polanská",
  description:
    "Kdo je Lucie Polanská, jak se dostala ke keramice a co ji na téhle práci baví.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  // this is the main page of the storefront
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  /*
   * Redakční obsah stránky „O mně". Zatím z něj bere název jen tlačítko
   * v závěrečné výzvě, ale trasa je tím hotová — další blok se do mapy
   * přidá bez sahání do stránky.
   */
  const copy = await getPageContentFull("o-mne")

  return (
    <>
      <ScrollToTopOnReload />
      <AboutPageExperience copy={copy} />
    </>
  )
}
