import { Metadata } from "next"

import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import ECom from "@modules/home/E-com"
import HeroSection from "@modules/home/Hero"
import HomeExperience from "@modules/home/HomeExperience"
import { getPageContentFull } from "@lib/data/site-copy"
import { getHeroNotices } from "@lib/data/notices"

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

  /*
   * Redakční obsah z ValeCMS. Dřív to byly čtyři dotazy do Sanity; teď je to
   * jedno čtení, protože bloky jedné stránky přijdou pohromadě, klíčované
   * podle `key` (`index.hero`, `index.news`…). Globální bloky (kontakt, mapa)
   * jsou v tom taky — patička je potřebuje pod každou routou.
   *
   * V téže mapě jsou i tlačítka, pod klíči `tlacitko.<klic>` — komponenty si
   * je berou přes `buttonLabel()` z `@lib/util/site-copy`, takže stránka
   * nepotřebuje druhý prop a mezikomponenty nic navíc nepodávají.
   *
   * Výpadek CMS tuhle stránku nepoloží: `getPageContentFull` vrací prázdno
   * a sekce se vykreslí s texty, které mají zabudované.
   */
  const [copy, notices] = await Promise.all([
    getPageContentFull("index"),
    getHeroNotices(),
  ])

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <HomeExperience>
        <HeroSection copy={copy} notices={notices} />
        <ECom copy={copy} />
      </HomeExperience>
    </>
  )
}
