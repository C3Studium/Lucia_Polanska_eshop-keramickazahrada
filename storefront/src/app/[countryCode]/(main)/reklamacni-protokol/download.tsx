import { getMerchantIdentity } from "@lib/data/merchant"

import styles from "./download.module.scss"

/**
 * TODO(matej): drop the official reklamační protokol PDF into `public/dokumenty/` and set this
 * to its path (e.g. "/dokumenty/reklamacni-protokol.pdf"). The download button then replaces
 * the placeholder automatically — nothing else needs changing.
 *
 * It stays `null` until the real document exists: a download button that 404s is worse than
 * saying plainly that the form is on its way (D-S6).
 */
const PROTOCOL_PDF_PATH: string | null = null

export default function ProtocolDownload() {
  const merchant = getMerchantIdentity()

  if (!PROTOCOL_PDF_PATH) {
    return (
      <div className={styles.placeholder}>
        <p className={styles.eyebrow}>Protokol ke stažení</p>
        <p>
          Formulář právě finalizujeme. Než ho sem doplníme, reklamaci vyřídíme stejně
          rychle e-mailem — napište nám na{" "}
          <a href={`mailto:${merchant.email}`}>{merchant.email}</a> číslo objednávky,
          popis vady a fotografie. Ozveme se vám s dalším postupem.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.download}>
      <p className={styles.eyebrow}>Protokol ke stažení</p>
      <a className={styles.button} href={PROTOCOL_PDF_PATH} download>
        Stáhnout reklamační protokol (PDF)
        <span aria-hidden="true">↓</span>
      </a>
    </div>
  )
}
