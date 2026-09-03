import SiteChrome from "@modules/layout/components/site-chrome"
import MotionPreferenceProvider from "@lib/context/MotionPreferenceProvider"
import EffectBudgetFlag from "@modules/layout/components/effect-budget-flag"
import { StateProvider } from "@lib/context/StateContext"
import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.scss"
import StudioClient from "@c3studium/valecms/manage/appClient.jsx";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  // Every page inherits the brand suffix; pages that are the brand itself opt out
  // with `title: { absolute: … }`.
  title: {
    default: "Keramická zahrada | Autorská keramika Lucie Polanské",
    template: "%s | Keramická zahrada",
  },
  description:
    "Ručně tvořená keramika pro zahradu i domov z píseckého ateliéru Lucie Polanské. Hotové kusy, zakázková výroba i keramické kurzy.",
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="cs" data-mode="light">
      <body>
        {/* Stamps the effect budget on <html> for every page, including the ones that render
            outside the (main) layout and have no shader of their own. */}
        <EffectBudgetFlag />
        <MotionPreferenceProvider>
          <StateProvider>
            {/* Rám stránky a plynulé scrollování — obojí vynechané nad
                /studio, kde je to aplikace, ne stránka. Viz komponentu. */}
            <SiteChrome>{props.children}</SiteChrome>
          </StateProvider>
        </MotionPreferenceProvider>
        <StudioClient />
      </body>
    </html>
  )
}
