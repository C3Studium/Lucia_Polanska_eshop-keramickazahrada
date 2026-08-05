import { ArrowUpRightMini } from "@medusajs/icons"
import styles from "./notfound.module.scss"
import Link from "next/link"
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  description: "Stránka, kterou jste se pokusili otevřít, neexistuje.",
}

export default function NotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>Stránka nenalezena</h1>
      <p className={styles.message}>
        Stránka, kterou jste se pokusili otevřít, neexistuje.
      </p>
      <Link className={styles.link} href="/">
        <p className={styles.linkText}>Zpět na úvodní stránku</p>
        <ArrowUpRightMini className={styles.arrow} color="var(--fg-interactive)" />
      </Link>
    </div>
  );
}
