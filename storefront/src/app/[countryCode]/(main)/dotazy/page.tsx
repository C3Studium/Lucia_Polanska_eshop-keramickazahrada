import { Metadata } from "next"
import { getFaqCategories, getFaqQuestions, getPageContentFull } from "@lib/data/site-copy"
import DotazyMain from "@modules/dotazy/main"


export const metadata: Metadata = {
  title: "Časté otázky",
  description:
    "Odpovědi na to, na co se ptáte nejčastěji — keramika, zakázková výroba, doprava, vrácení zboží i kurzy.",
}

export default async function FAQPage() {
  /*
   * Otázky jsou dokumenty typu `qna` — jedna otázka = jeden dokument, ve
   * Studiu vlastní sekce „Dotazy". Kategorie je slovo na otázce; čipy filtru
   * z nich stránka skládá sama. Bloky vedle nesou texty kolem seznamu.
   */
  const [copy, questions, categories] = await Promise.all([
    getPageContentFull("dotazy"),
    getFaqQuestions(),
    getFaqCategories(),
  ])

  return (
    <>
        <DotazyMain
          block={copy["dotazy.galerie"]}
          texts={copy["dotazy.otazky"]}
          hero={copy["dotazy.hero"]}
          cmsQuestions={questions}
          cmsCategories={categories}
        />
    </>
  )
}
