import LenisProvider from "@lib/context/LenisContext"
import MotionPreferenceProvider from "@lib/context/MotionPreferenceProvider"
import { StateProvider } from "@lib/context/StateContext"
import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.scss"

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
        <MotionPreferenceProvider>
          <StateProvider>
            <LenisProvider>
              <main className="pageFrame relative">{props.children}</main>
            </LenisProvider>
          </StateProvider>
        </MotionPreferenceProvider>
      </body>
    </html>
  )
}
