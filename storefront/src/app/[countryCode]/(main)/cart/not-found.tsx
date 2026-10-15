import { getNotFoundCopy } from "@lib/data/site-copy"
import CmsText from "@modules/common/components/cms-text"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "./styles/notfound.module.scss"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Tuhle stránku jsme nenašli.",
}

// Texty z bloku `global.nenalezeno`; z košíku vede odkaz do obchodu (`odkaz.obchod`).
export default async function NotFound() {
  const copy = await getNotFoundCopy()

  return (
    <div className={styles.root}>
      <CmsText as="h1" className={styles.heading} doc={copy.doc} field="title">
        {copy.title}
      </CmsText>
      <CmsText as="p" className={styles.message} doc={copy.doc} field="body">
        {copy.message}
      </CmsText>
      <LocalizedClientLink href="/store">
        <CmsText doc={copy.doc} field={copy.fields.store}>{copy.store}</CmsText>
      </LocalizedClientLink>
    </div>
  );
}
