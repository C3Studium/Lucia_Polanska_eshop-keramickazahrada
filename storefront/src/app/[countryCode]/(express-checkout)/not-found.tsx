import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Stránka, kterou jste se pokusili otevřít, neexistuje.",
}

export default async function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100dv-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">Stránka nenalezena</h1>
      <p className="text-small-regular text-ui-fg-base">
        Stránka, kterou jste se pokusili otevřít, neexistuje.
      </p>
      <LocalizedClientLink className="underline" href="/">
        Zpět na úvodní stránku
      </LocalizedClientLink>
    </div>
  )
}
