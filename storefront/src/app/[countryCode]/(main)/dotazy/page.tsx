import { Metadata } from "next"
import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import DotazyMain from "@modules/dotazy/main"


export const metadata: Metadata = {
  title: "Časté otázky | Keramická zahrada",
  description:
    "Odpovědi na časté otázky o autorské keramice, zakázkové výrobě, dopravě, vrácení zboží a keramických kurzech.",
}

export default function FAQPage() {
  return (
    <>
        <ScrollToTopOnReload />
        <DotazyMain />
    </>
  )
}
