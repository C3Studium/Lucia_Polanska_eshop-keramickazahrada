import { Metadata } from "next"

import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import ECom from "@modules/home/E-com"
import HeroSection from "@modules/home/Hero"
import HomeExperience from "@modules/home/HomeExperience"
import { client } from "../../../sanity/lib/client"

export const metadata: Metadata = {
  title: { absolute: "Keramická zahrada | Autorská keramika Lucie Polanské" },
  description:
    "Ručně tvořená keramika pro zahradu i domov z píseckého ateliéru Lucie Polanské. Hotové kusy, zakázková výroba i keramické kurzy.",
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

  const [settings, introHero, newsText, ecomIntro] = await Promise.all([
    client.fetch('*[_type == "mainPageSettings"][0]'),
    client.fetch('*[_type == "introHero"][0]'),
    client.fetch('*[_type == "newsText"][0]'),
    client.fetch('*[_type == "ecomIntro"][0]'),
  ])

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <ScrollToTopOnReload />
      <HomeExperience>
        <HeroSection
          settings={settings}
          introHero={introHero}
          newsText={newsText?.text}
        />
        <ECom settings={settings} introData={ecomIntro} />
      </HomeExperience>
    </>
  )
}
