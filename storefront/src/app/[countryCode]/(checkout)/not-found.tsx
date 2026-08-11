import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "./styles/notfound.module.scss"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Tuhle stránku jsme nenašli.",
}

export default async function NotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>Stránka nenalezena</h1>
      <p className={styles.message}>
        Tuhle stránku jsme nenašli. Možná se přesunula, nebo tu nikdy nebyla.
      </p>
      <LocalizedClientLink href="/">Zpět na úvodní stránku</LocalizedClientLink>
    </div>
  );
}
