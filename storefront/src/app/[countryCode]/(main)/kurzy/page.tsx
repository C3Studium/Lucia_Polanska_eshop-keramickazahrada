import { Metadata } from "next"
import { client } from "../../../../sanity/lib/client"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import Kurzy from "@modules/home/Kurzy"
import type { KurzyIntroData } from "@modules/home/Kurzy/Intro"

export const metadata: Metadata = {
  title: "Keramické kurzy",
  description:
    "Keramické kurzy pro děti a připravované kurzy pro dospělé v ateliéru Lucie Polanské u Písku.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  // this is the main page of the storefront
  const params = await props.params

  const { countryCode } = params

  const [region, { collections }, kurzyIntroData] = await Promise.all([
    getRegion(countryCode),
    listCollections({ fields: "id, handle, title" }),
    client.fetch<KurzyIntroData>('*[_type == "kurzyIntro"][0]'),
  ])

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <ScrollToTopOnReload />
      <Kurzy introData={kurzyIntroData} />
    </>
  )
}
