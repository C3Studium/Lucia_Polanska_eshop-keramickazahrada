import { Metadata } from "next"

import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import VyrobaCta from "@modules/vyroba/cta"
import VyrobaJourney from "@modules/vyroba/journey"

export const metadata: Metadata = {
  title: "Jak vzniká keramika",
  description:
    "Sedm kroků ruční výroby keramiky — od prvního návrhu přes modelování a výpal až po hotový kus.",
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
