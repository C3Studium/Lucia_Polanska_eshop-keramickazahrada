import { Metadata } from "next"

import { getNotFoundCopy } from "@lib/data/site-copy"
import CmsText from "@modules/common/components/cms-text"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./notfound.module.scss"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Tuhle stránku jsme nenašli.",
}

// Texty z bloku `global.nenalezeno` (viz getNotFoundCopy); výpadek CMS = tyhle z kódu.
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
      <LocalizedClientLink className={styles.link} href="/">
        <CmsText doc={copy.doc} field={copy.fields.home}>{copy.home}</CmsText>
      </LocalizedClientLink>
    </div>
  )
}
