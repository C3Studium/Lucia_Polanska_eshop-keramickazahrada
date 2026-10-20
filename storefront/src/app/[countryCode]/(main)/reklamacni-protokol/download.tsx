"use client"

import styles from "./download.module.scss"

/**
 * Formulář ke stažení přímo u kapitoly „Reklamační formulář".
 *
 * PDF generuje `pnpm legal:build` z registru (celý protokol včetně
 * formuláře) a jeho adresu nese `pdf-manifest.json`. Dokud pro platné znění
 * PDF neexistuje, nabízí se tisk stránky — dřívější věta „Formulář ještě
 * dokončujeme" je pryč, formulář je teď součástí dokumentu.
 */
export default function ProtocolDownload({ pdfHref }: { pdfHref: string | null }) {
  return (
    <div className={styles.download}>
      <p className={styles.eyebrow}>Protokol ke stažení</p>
      {pdfHref ? (
        <a
          className={styles.button}
          href={pdfHref}
          download
          target="_blank"
          rel="noopener noreferrer"
        >
          Stáhnout reklamační protokol (PDF)
          <span aria-hidden="true">↓</span>
        </a>
      ) : (
        <button
          type="button"
          className={`${styles.button} ${styles.printButton}`}
          onClick={() => window.print()}
        >
          Vytisknout formulář
          <span aria-hidden="true">↗</span>
        </button>
      )}
    </div>
  )
}
