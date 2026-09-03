import type { CopyFile } from "@lib/util/site-copy"

import styles from "./style.module.scss"

/**
 * Dokumenty ke stažení pod právním textem.
 *
 * Formuláře, které si zákazník tiskne a posílá zpátky — reklamační protokol,
 * odstoupení od smlouvy. Spravují se ve Studiu jako typ „Soubory ke stažení";
 * tahle komponenta je jen vypisuje.
 *
 * ## Prázdný seznam nic nevykreslí
 *
 * Nadpis „Ke stažení" nad prázdným místem je horší než ticho: čtenář hledá
 * odkaz, který tam není, a myslí si, že se něco nenačetlo.
 *
 * ## Proč `download` a `rel`
 *
 * Soubory leží v knihovně médií, tedy na jiné doméně (`CMS_MEDIA_HOST`).
 * `download` řekne prohlížeči, že se PDF má uložit, ne otevřít v prohlížeči
 * na cizí doméně; `noopener` proto, že cíl je jiný původ a nemá mít přístup
 * k `window.opener`.
 */
export default function LegalDownloads({ files }: { files: CopyFile[] }) {
  if (!files.length) return null

  return (
    <section className={styles.downloads} aria-labelledby="ke-stazeni">
      <div className={styles.heading}>
        <span>Ke stažení</span>
        <h2 id="ke-stazeni">Formuláře</h2>
      </div>

      <ul className={styles.list}>
        {files.map((file) => (
          <li key={file.id ?? file.url}>
            <a
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={styles.item}
            >
              <span className={styles.kind} aria-hidden="true">
                {file.mime === "application/pdf" ? "PDF" : "SOUBOR"}
              </span>
              <span className={styles.text}>
                <strong>{file.nazev}</strong>
                {file.popis ? <small>{file.popis}</small> : null}
              </span>
              {/* Velikost je pro rozhodnutí, ne pro ozdobu: na mobilních datech
                  je rozdíl mezi 80 kB a 8 MB důvod počkat na wifi. Skrytá pro
                  odečítač obrazovky není — je součástí odkazu. */}
              {file.size > 0 ? (
                <span className={styles.size}>{formatSize(file.size)}</span>
              ) : null}
            </a>
          </li>
        ))}
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
