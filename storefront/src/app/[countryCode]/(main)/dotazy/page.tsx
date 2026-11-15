import { Metadata } from "next"
import { getFaq, getPageContentFull, getPageSeo } from "@lib/data/site-copy"
import DotazyMain from "@modules/dotazy/main"


// Titulek a popis z bloku `dotazy.seo`; tohle je záloha pro prázdné CMS.
export async function generateMetadata(): Promise<Metadata> {
  return getPageSeo("dotazy", {
    title: "Časté otázky",
    description:
      "Odpovědi na to, na co se ptáte nejčastěji — keramika, zakázková výroba, doprava, vrácení zboží i kurzy.",
  })
}

export default async function FAQPage(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  /*
   * Otázky jsou dokumenty typu `qna` — jedna otázka = jeden dokument, ve
   * Studiu vlastní sekce „Dotazy". Kategorie je slovo na otázce; čipy filtru
   * z nich stránka skládá sama. Bloky vedle nesou texty kolem seznamu.
   *
   * Od 15. 11. 2026 je všechno ve Studiu v sekci FAQ (kategorie = dokument,
   * otázky uvnitř), včetně dřívější pevné právní sekce.
   */
  const [copy, { questions, categories }] = await Promise.all([
    getPageContentFull("dotazy"),
    getFaq(),
  ])

  return (
    <>
        <DotazyMain
          block={copy["dotazy.galerie"]}
          texts={copy["dotazy.otazky"]}
          hero={copy["dotazy.hero"]}
          cmsQuestions={questions}
          cmsCategories={categories}
          countryCode={countryCode}
        />
    </>
  )
}
