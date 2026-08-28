import { Metadata } from "next"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./notfound.module.scss"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Tuhle stránku jsme nenašli.",
}

export default function NotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>Stránka nenalezena</h1>
      <p className={styles.message}>
        Tuhle stránku jsme nenašli. Možná se přesunula, nebo tu nikdy nebyla.
      </p>
      <LocalizedClientLink className={styles.link} href="/">
        Zpět na úvodní stránku
      </LocalizedClientLink>
    </div>
  )
}
