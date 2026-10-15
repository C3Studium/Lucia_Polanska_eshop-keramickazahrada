"use client"

import styles from "./style.module.scss"

/**
 * „Ke stažení" pod právním textem — PDF dané verze, tisk a další znění.
 *
 * Dřív tu byly soubory z CMS (Studio, typ „Soubory ke stažení"). U právních
 * dokumentů to bylo nebezpečné: PDF nahrané do knihovny médií se s textem
 * neaktualizovalo, takže stránka mohla nabízet staré znění vedle nového.
 * PDF teď generuje `pnpm legal:build` přímo z registru a jeho adresu nese
 * `pdf-manifest.json`; dokud pro verzi PDF není, nabízí se tisk stránky.
 *
 * ## Prázdný seznam nic nevykreslí
 *
 * Nadpis „Ke stažení" nad prázdným místem je horší než ticho: čtenář hledá
 * odkaz, který tam není, a myslí si, že se něco nenačetlo.
 */

export type LegalDownloadItem =
  | { kind: "pdf"; href: string; title: string; description?: string; bytes?: number }
  | { kind: "print"; title: string; description?: string }
  | { kind: "link"; href: string; title: string; description?: string }

const KIND_LABEL: Record<LegalDownloadItem["kind"], string> = {
  pdf: "PDF",
  print: "TISK",
  link: "ZNĚNÍ",
}

export default function LegalDownloads({ items }: { items: LegalDownloadItem[] }) {
  if (!items.length) return null

  return (
    <section className={styles.downloads} aria-labelledby="ke-stazeni">
      <div className={styles.heading}>
        <span>Ke stažení</span>
        <h2 id="ke-stazeni">Dokument a jeho znění</h2>
      </div>

      <ul className={styles.list}>
        {items.map((item, index) => {
          const body = (
            <>
              <span className={styles.kind} aria-hidden="true">
                {KIND_LABEL[item.kind]}
              </span>
              <span className={styles.text}>
                <strong>{item.title}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              {/* Velikost je pro rozhodnutí, ne pro ozdobu: na mobilních datech
                  je rozdíl mezi 80 kB a 8 MB důvod počkat na wifi. */}
              {item.kind === "pdf" && item.bytes ? (
                <span className={styles.size}>{formatSize(item.bytes)}</span>
              ) : null}
            </>
          )

          return (
            <li key={`${item.kind}-${index}`}>
              {item.kind === "print" ? (
                <button
                  type="button"
                  className={`${styles.item} ${styles.button}`}
                  onClick={() => window.print()}
                >
                  {body}
                </button>
              ) : item.kind === "pdf" ? (
                /* PDF leží v R2 (jiný původ) nebo v `/legal/` storefrontu:
                   `download` ho uloží místo otevření na cizí doméně,
                   `noopener` proto, že cíl nemá dostat `window.opener`. */
                <a
                  href={item.href}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.item}
                >
                  {body}
                </a>
              ) : (
                <a href={item.href} className={styles.item}>
                  {body}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Velikost v jednotkách, které se čtou — ne v bajtech. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}
