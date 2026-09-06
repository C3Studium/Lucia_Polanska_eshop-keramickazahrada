import { Metadata } from "next"

import { getPageContentFull } from "@lib/data/site-copy"
import VyrobaCta from "@modules/vyroba/cta"
import VyrobaJourney from "@modules/vyroba/journey"

export const metadata: Metadata = {
  title: "Jak vzniká keramika",
  description:
    "Sedm kroků ruční výroby keramiky — od prvního návrhu přes modelování a výpal až po hotový kus.",
}

export default async function Home() {
  /*
   * Redakční obsah stránky „Výroba" — dnes z něj sekce berou jen název
   * tlačítka, ale trasa je tím postavená: mapa jde dolů jako `copy` a další
   * blok se do ní přidá bez sahání do stránky.
   *
   * Výpadek CMS tuhle stránku nepoloží — vrátí se prázdno a sekce se
   * vykreslí s texty, které mají zabudované.
   */
  const copy = await getPageContentFull("vyroba")

  return (
    <>
      <VyrobaJourney
        block={copy["vyroba.galerie"]}
        texts={copy["vyroba.kroky"]}
        hero={copy["vyroba.hero"]}
      />
      <VyrobaCta copy={copy} />
    </>
  )
}
