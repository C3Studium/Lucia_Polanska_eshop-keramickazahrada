import type { Certificates } from "@lib/data/certificates"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number)
  return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) ? `${d}. ${m}. ${y}` : iso
}

/**
 * Stránka /certifikaty — protokoly o nezávadnosti glazur (LEGAL_AUDIT § 0b, N1).
 * Doklady nahrává Lucie ve Studiu („Certifikáty a protokoly",
 * `lib/data/certificates.ts`), záloha je v `lib/certificates.ts`. Úvodní
 * a závěrečné texty jsou v kódu — říkají, co protokol musí pokrýt. Bez
 * protokolů stránka neříká, že něco je ověřené — jen kde se ptát.
 */
export default function Certifikaty({
  email,
  certificates,
}: {
  email: string
  certificates: Certificates
}) {
  const { glazes, declarations } = certificates
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Nezávadnost · doklady</p>
        <h1 className={styles.title}>Certifikáty a protokoly o nezávadnosti glazur</h1>
        <p className={styles.lead}>
          Keramika, kterou nabízím na jídlo a pití nebo u které uvádím „zdravotně nezávadné
          glazury“, musí splňovat limity pro uvolňování olova a kadmia (nařízení (ES)
          č. 1935/2004, vyhláška č. 38/2001 Sb.). Tady jsou protokoly ze zkoušek — u každého
          je datum a glazura, které se týká.
        </p>
      </header>

      {glazes.length > 0 ? (
        <ul className={styles.list}>
          {glazes.map((certificate) => (
            <li key={`${certificate.glaze}-${certificate.issuedAt}`} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.glaze}>{certificate.glaze}</span>
                <span className={styles.meta}>
                  {formatDate(certificate.issuedAt)}
                  {certificate.laboratory ? ` · ${certificate.laboratory}` : ""}
                  {certificate.number ? ` · č. ${certificate.number}` : ""}
                </span>
              </div>
              {certificate.scope && <p className={styles.scope}>{certificate.scope}</p>}
              <a className={styles.link} href={certificate.url} target="_blank" rel="noopener">
                Protokol (PDF)
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <section className={styles.empty} aria-live="polite">
          <p>
            Seznam protokolů právě doplňujeme. Na protokol ke konkrétní glazuře se nás
            do té doby můžete zeptat e-mailem na{" "}
            <a href={`mailto:${email}`}>{email}</a>.
          </p>
        </section>
      )}

      {declarations.length > 0 && (
        <section className={styles.notes}>
          <h2 className={styles.subtitle}>Prohlášení o shodě (elektro)</h2>
          <ul className={styles.list}>
            {declarations.map((declaration) => (
              <li key={declaration.product} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.glaze}>{declaration.product}</span>
                  <span className={styles.meta}>
                    {formatDate(declaration.issuedAt)}
                    {declaration.manufacturer ? ` · ${declaration.manufacturer}` : ""}
                  </span>
                </div>
                <p className={styles.scope}>{declaration.scope}</p>
                <p className={styles.scope}>
                  {declaration.productPath && (
                    <LocalizedClientLink href={declaration.productPath}>Výrobek v obchodě</LocalizedClientLink>
                  )}
                  {declaration.url ? (
                    <>
                      {declaration.productPath ? " · " : ""}
                      <a className={styles.link} href={declaration.url} target="_blank" rel="noopener">
                        Prohlášení o shodě (PDF)
                      </a>
                    </>
                  ) : (
                    `${declaration.productPath ? " · " : ""}prohlášení zveřejníme po nahrání`
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p>
            Elektrozařízení nepatří do směsného odpadu — vysloužilý zvonek odevzdejte na sběrném
            místě nebo nám ho vraťte.
          </p>
        </section>
      )}

      <section className={styles.notes}>
        <h2 className={styles.subtitle}>Co to znamená v praxi</h2>
        <ul>
          <li>
            Výrobek bez uvedené nezávadnosti (dekorace, výrobky z kurzů) pro jídlo a pití
            nepoužívejte.
          </li>
          <li>
            Keramika je křehká: rozbitý kus má ostré hrany, střepy ukliďte opatrně a mimo
            dosah dětí.
          </li>
          <li>
            V zimě v pítku ani jiné nádobě nenechávejte zamrznout vodu — led ji může
            roztrhnout.
          </li>
        </ul>
        <p>
          Další odpovědi jsou v{" "}
          <LocalizedClientLink href="/dotazy#faq-bezpecnost">častých otázkách</LocalizedClientLink>{" "}
          a v <LocalizedClientLink href="/reklamacni-rad">reklamačním řádu</LocalizedClientLink>.
        </p>
      </section>
    </main>
  )
}
