import { Metadata } from "next"
import { client } from "../../../../sanity/lib/client"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import AboutPageExperience from "@modules/omne/page"

export const metadata: Metadata = {
  title: "O mně | Lucie Polanská",
  description:
    "Poznejte Lucii Polanskou, její cestu ke keramice, rukopis a inspiraci za objekty z Keramické zahrady.",
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

  // Fetch main page settings from Sanity
  const settings = await client.fetch('*[_type == "mainPageSettings"][0]')

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <ScrollToTopOnReload />
      <AboutPageExperience />
    </>
  )
}
