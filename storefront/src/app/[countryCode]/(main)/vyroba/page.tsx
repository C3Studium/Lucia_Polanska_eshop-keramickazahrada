import { Metadata } from "next"

import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import VyrobaCta from "@modules/vyroba/cta"
import VyrobaJourney from "@modules/vyroba/journey"

export const metadata: Metadata = {
  title: "Jak vzniká keramika",
  description:
    "Poznejte sedm kroků ruční výroby autorské keramiky Lucie Polanské – od prvního návrhu přes modelování a výpal až po hotový objekt.",
}

export default function Home() {
  return (
    <>
      <ScrollToTopOnReload />
      <VyrobaJourney />
      <VyrobaCta />
    </>
  )
}
