import { Metadata } from "next"
import { listCollections } from "@lib/data/collections"
import { listCourseTerms } from "@lib/data/courses"
import { getLegalFacts } from "@lib/data/legal-facts"
import { getRegion } from "@lib/data/regions"

import Kurzy from "@modules/home/Kurzy"
import KurzyPodminky from "@modules/kurzy/Podminky"
import { getPageCopyWithGlobal, getPageSeo } from "@lib/data/site-copy"

// Titulek a popis z bloku `kurzy.seo`; tohle je záloha pro prázdné CMS.
export async function generateMetadata(): Promise<Metadata> {
  return getPageSeo("kurzy", {
    title: "Keramické kurzy",
    description:
      "Keramické kurzy pro děti a chystané kurzy pro dospělé v ateliéru u Písku.",
  })
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  // this is the main page of the storefront
  const params = await props.params

  const { countryCode } = params

  /*
   * Termíny, kapacity a ceny drží Medusa (`listCourseTerms`); z CMS sem chodí
   * jen redakční část stránky — úvodní text a fotky. Kdyby CMS někdy začalo
   * popisovat termíny, jsou to dva zdroje pravdy o jedné věci.
   */
  const [region, { collections }, copy, terms, legalFacts] = await Promise.all([
    getRegion(countryCode),
    listCollections({ fields: "id, handle, title" }),
    getPageCopyWithGlobal("kurzy"),
    listCourseTerms(),
    // Storno podmínky a e-mail v rezervaci — právní údaje z administrace obchodu.
    getLegalFacts(),
  ])

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Kurzy copy={copy} terms={terms} legalFacts={legalFacts} countryCode={countryCode} />
      {/* Poučení o vyloučení odstoupení (§ 1837 písm. j) OZ) a storno podmínky.
          Za <Kurzy>, protože ta vrací vlastní <main> a do modulu home/Kurzy
          se odsud nesahá; proto je to <aside> s vlastním nadpisem. */}
      <KurzyPodminky countryCode={countryCode} />
    </>
  )
}
