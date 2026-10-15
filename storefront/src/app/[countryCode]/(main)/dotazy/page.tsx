import { Metadata } from "next"
import { getFaqCategories, getFaqQuestions, getPageContentFull } from "@lib/data/site-copy"
import DotazyMain from "@modules/dotazy/main"


export const metadata: Metadata = {
  title: "Časté otázky",
  description:
    "Odpovědi na to, na co se ptáte nejčastěji — keramika, zakázková výroba, doprava, vrácení zboží i kurzy.",
}

export default async function FAQPage(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params

  /*
   * Otázky jsou dokumenty typu `qna` — jedna otázka = jeden dokument, ve
   * Studiu vlastní sekce „Dotazy". Kategorie je slovo na otázce; čipy filtru
   * z nich stránka skládá sama. Bloky vedle nesou texty kolem seznamu.
   *
   * Pod nimi je vždy pevná sekce právních otázek z `@lib/legal/faq`
   * (zakázky, kurzy, poukazy, rozbitá zásilka) — ta z CMS nejde.
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
          countryCode={countryCode}
        />
    </>
  )
}
