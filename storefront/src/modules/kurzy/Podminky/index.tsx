import { getLegalFacts } from "@lib/data/legal-facts"
import { renderInline } from "@lib/legal/inline"

import styles from "./styles.module.scss"

/**
 * „Podmínky kurzů" na stránce Kurzy — poučení o vyloučení odstoupení
 * (§ 1837 písm. j) OZ) a storno podmínky, ještě než si člověk otevře
 * rezervaci. Shrnutí obchodních podmínek čl. X (kotva `#kurzy`); při změně
 * OP upravit i tady.
 *
 * Text je v kódu, ne v CMS: jde o poučení, které musí odpovídat OP. Storno,
 * minimální věk a lhůta pro vyzvednutí jsou právní údaje z administrace
 * obchodu (`getLegalFacts()`) — dokud je zadavatel nedodá, svítí jako
 * `[[DOPLNIT]]`. Serverová komponenta, fakty si načte sama.
 */

const TERMS: { term: string; text: string }[] = [
  { term: "Storno", text: "{{course.cancellation}}" },
  {
    term: "Když kurz zruším já",
    text: "Vrátím vám celou zaplacenou částku, nebo si vyberete náhradní termín.",
  },
  {
    term: "Platba",
    text: "Předem online, nebo na místě v den kurzu. Online rezervace, která není do 24 hodin zaplacená, propadne a místo se uvolní.",
  },
  {
    term: "Děti",
    text: "Rezervaci dělá rodič nebo jiný zákonný zástupce. Minimální věk: {{course.minAge}}. Mimo vedenou práci (příchod, přestávky, odchod) za dítě odpovídá rodič.",
  },
  {
    term: "Výrobky",
    text: "Po kurzu je vysuším a vypálím; vyzvednete si je v ateliéru do {{course.pickupDeadline}}.",
  },
  {
    term: "Fotky",
    text: "Fotky, na kterých jste vy nebo vaše dítě, zveřejním jen s vaším souhlasem.",
  },
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
          <div className={styles.notice} role="note">
            <p>
              {inline(
                "**Od rezervace kurzu nelze odstoupit do 14 dnů.** Kurz je služba spojená s využitím volného času poskytovaná v určitém termínu — u takové služby zákon právo odstoupit od smlouvy bez udání důvodu vylučuje (§ 1837 písm. j) občanského zákoníku). Místo toho platí storno podmínky níže."
              )}
            </p>
          </div>

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
