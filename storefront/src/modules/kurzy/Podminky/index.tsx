import { getLegalFacts } from "@lib/data/legal-facts"
import { renderInline } from "@lib/legal/inline"

import styles from "./styles.module.scss"

/**
 * „Podmínky kurzů" na stránce Kurzy — poučení o vyloučení odstoupení
 * (§ 1837 písm. j) OZ) a storno podmínky, ještě než si člověk otevře
 * rezervaci. Shrnutí obchodních podmínek čl. X (kotva `#kurzy`); při změně
 * OP upravit i tady.
 *
 * Řádky jsou právní údaje z administrace obchodu (Právní údaje › Kurzy,
 * `getLegalFacts()`) — nevyplněný svítí jako `[[DOPLNIT]]`. Poučení
 * o vyloučení odstoupení (§ 1837 písm. j) OZ) tu od 21. 11. 2026 není
 * (Matěj): zákazník ho dostane v okně rezervace a v obchodních podmínkách.
 * Serverová komponenta, fakty si načte sama.
 */

const TERMS: { term: string; text: string }[] = [
  { term: "Storno", text: "{{course.cancellation}}" },
  { term: "Když kurz zruším já", text: "{{course.organizerCancellation}}" },
  { term: "Platba", text: "{{course.payment}}" },
  { term: "Děti", text: "{{course.children}} Věk: {{course.minAge}}." },
  {
    term: "Výrobky",
    text: "{{course.products}} Vyzvednete si je v ateliéru do {{course.pickupDeadline}}.",
  },
  { term: "Fotky", text: "{{course.photos}}" },
]

export default async function KurzyPodminky({ countryCode = "cz" }: { countryCode?: string }) {
  const facts = await getLegalFacts()
  const inline = (text: string) =>
    renderInline(text, {
      hrefFor: (path) => `/${countryCode}${path}`,
      placeholderClassName: styles.placeholder,
      facts,
    })

  return (
    <aside className={styles.podminky} id="podminky" aria-labelledby="kurzy-podminky-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span>04 · Podmínky</span>
          <h2 id="kurzy-podminky-title">
            Podmínky kurzů.
            <em>Krátce a narovinu.</em>
          </h2>
          <p>
            {inline(
              "Rezervací uzavíráte smlouvu o účasti na kurzu v daném termínu. Odešlete ji tlačítkem **„Rezervace zavazující k platbě“** a já vám ji potvrdím e-mailem."
            )}
          </p>
        </header>

        <div className={styles.body}>
          <dl className={styles.terms}>
            {TERMS.map((item) => (
              <div key={item.term}>
                <dt>{item.term}</dt>
                <dd>{inline(item.text)}</dd>
              </div>
            ))}
          </dl>

          <p className={styles.more}>
            {inline(
              "[Celé podmínky kurzů v obchodních podmínkách](/smluvni-podminky#kurzy) · [Časté otázky ke kurzům](/dotazy#faq-kurzy)"
            )}
          </p>
        </div>
      </div>
    </aside>
  )
}
