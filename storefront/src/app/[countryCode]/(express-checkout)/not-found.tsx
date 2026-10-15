import { getNotFoundCopy } from "@lib/data/site-copy"
import CmsText from "@modules/common/components/cms-text"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Tuhle stránku jsme nenašli.",
}

// Texty z bloku `global.nenalezeno` (viz getNotFoundCopy); výpadek CMS = tyhle z kódu.
export default async function NotFound() {
  const copy = await getNotFoundCopy()

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100dv-64px)]">
      <CmsText as="h1" className="text-2xl-semi text-ui-fg-base" doc={copy.doc} field="title">
        {copy.title}
      </CmsText>
      <CmsText as="p" className="text-small-regular text-ui-fg-base" doc={copy.doc} field="body">
        {copy.message}
      </CmsText>
      <LocalizedClientLink className="underline" href="/">
        <CmsText doc={copy.doc} field={copy.fields.home}>{copy.home}</CmsText>
      </LocalizedClientLink>
    </div>
  )
}
