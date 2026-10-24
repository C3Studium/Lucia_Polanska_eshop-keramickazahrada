import { CONTACT_EMAIL } from "../format"
import styles from "../panel.module.scss"

/**
 * Špatný nebo neúplný odkaz (chybí token, token nesedí, poukaz neexistuje).
 * Záměrně jedna stránka pro všechny případy — z odpovědi se nedá poznat,
 * jestli poukaz s tímhle id existuje.
 */
export default function PoukazNenalezen() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <span className={styles.eyebrow} data-tone="warn">
          Dárkový poukaz
        </span>
        <h1>
          Poukaz se nepodařilo
          <em>najít.</em>
        </h1>
        <p className={styles.lede}>
          Zkontrolujte prosím odkaz z e-mailu — nejjistější je otevřít ho
          tlačítkem přímo v e-mailu, ať se nic neusekne. Kdyby to pořád
          nešlo, napište mi na{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> a poukaz
          dohledám.
        </p>
      </section>
    </main>
  )
}
