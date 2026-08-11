import { Metadata } from "next"
import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import DotazyMain from "@modules/dotazy/main"


export const metadata: Metadata = {
  title: "Časté otázky",
  description:
    "Odpovědi na to, na co se ptáte nejčastěji — keramika, zakázková výroba, doprava, vrácení zboží i kurzy.",
}

export default function FAQPage() {
  return (
    <>
        <ScrollToTopOnReload />
        <DotazyMain />
    </>
  )
}
