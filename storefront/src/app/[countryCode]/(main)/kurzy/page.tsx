import { Metadata } from "next"
import { listCollections } from "@lib/data/collections"
import { listCourseTerms } from "@lib/data/courses"
import { getRegion } from "@lib/data/regions"

import Kurzy from "@modules/home/Kurzy"
import { getPageCopyWithGlobal } from "@lib/data/site-copy"

export const metadata: Metadata = {
  title: "Keramické kurzy",
  description:
    "Keramické kurzy pro děti a chystané kurzy pro dospělé v ateliéru u Písku.",
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
  const [region, { collections }, copy, terms] = await Promise.all([
    getRegion(countryCode),
    listCollections({ fields: "id, handle, title" }),
    getPageCopyWithGlobal("kurzy"),
    listCourseTerms(),
  ])

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Kurzy copy={copy} terms={terms} />
    </>
  )
}
