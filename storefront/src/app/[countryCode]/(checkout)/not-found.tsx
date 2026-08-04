import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "./styles/notfound.module.scss"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Stránka, kterou jste se pokusili otevřít, neexistuje.",
}

export default async function NotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>Stránka nenalezena</h1>
      <p className={styles.message}>
        Stránka, kterou jste se pokusili otevřít, neexistuje.
      </p>
      <LocalizedClientLink href="/">Zpět na úvodní stránku</LocalizedClientLink>
    </div>
  );
}
