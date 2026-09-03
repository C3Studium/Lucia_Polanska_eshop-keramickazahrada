"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import LenisProvider from "@lib/context/LenisContext"

/**
 * Chrome webu — a jeho vypnutí nad Studiem.
 *
 * ## Co se dělo
 *
 * `/studio` bydlí pod stejným kořenovým layoutem jako web, takže dědilo dvě
 * věci, které jsou pro stránku správné a pro aplikaci ne:
 *
 * 1. **`.pageFrame`** — `max-width: var(--page-max-w)` a vycentrování. Nad
 *    1921 px se `--page-max-w` počítá jako `min(100vw, 100svh * 1.6)`, takže na
 *    monitoru 2543×1357 se Studio ořízlo na 2171 px a po stranách zbylo 186 px
 *    pruhu `#141513`. Tlačítka u pravé hrany (Uložit, Oříznout) skončila mimo
 *    viditelnou plochu.
 * 2. **`LenisProvider`** — plynulé scrollování přebírá `wheel` na celém
 *    dokumentu. Uvnitř Studia to znamená, že postranní panel, knihovna médií
 *    ani dialogy nejdou odrolovat: kolečko sebere Lenis dřív, než se dostane
 *    k prvku, který má vlastní `overflow`.
 *
 * K tomu ještě globální `body { height: fit-content }` a schované scrollbary,
 * které aplikaci na celou výšku podrážejí nohy. Ty řeší CSS v `globals.scss`
 * pod `[data-app="studio"]` — proto se ten atribut odsud razí.
 *
 * ## Proč takhle
 *
 * Rozdělit kořenový layout na route groups by znamenalo přestěhovat
 * `app/[countryCode]` do skupiny a sáhnout na každou stránku webu. Tohle je
 * jedna komponenta, která se ptá na cestu a nad Studiem chrome prostě vynechá.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const isStudio = pathname === "/studio" || pathname.startsWith("/studio/")

  useEffect(() => {
    const root = document.documentElement
    if (isStudio) {
      root.dataset.app = "studio"
    } else {
      delete root.dataset.app
    }
    return () => {
      delete root.dataset.app
    }
  }, [isStudio])

  // Studio dostane holé děti — žádný rám, žádné plynulé scrollování.
  if (isStudio) {
    return <>{children}</>
  }

  return (
    <LenisProvider>
      <main className="pageFrame relative">{children}</main>
    </LenisProvider>
  )
}
