"use client"

import { LEGAL_FAQ } from "@lib/legal/faq"
import { useLegalFacts } from "@lib/legal/facts-context"
import { renderInline } from "@lib/legal/inline"

import styles from "./style.module.scss"

/**
 * Pevná sekce „Práva a podmínky" pod otázkami z CMS na stránce Dotazy.
 *
 * Vykresluje se vždy — i když CMS otázky má (fallback seznamu v FAQ/index.tsx
 * se ukáže jen při prázdném CMS). Odpovědi slibují konkrétní práva, takže
 * jejich znění drží `@lib/legal/faq` vedle obchodních podmínek, ne redakce.
 *
 * Nativní `<details>` místo animovaného akordeonu nad ní: funguje bez
 * JavaScriptu, s klávesnicí i v odečítači, a obsah najde i hledání v prohlížeči.
 *
 * Údaje `{{…}}` (záloha zakázky, storno kurzů, platnost poukazu) jsou právní
 * údaje z administrace obchodu — vykresluje se uvnitř klientského FAQ, takže
 * je bere z kontextu (`useLegalFacts()`, načte kořenový layout).
 */
export default function LegalFaq({ countryCode = "cz" }: { countryCode?: string }) {
  const facts = useLegalFacts()
  const inline = (text: string) =>
    renderInline(text, {
      hrefFor: (path) => `/${countryCode}${path}`,
      placeholderClassName: styles.placeholder,
      facts,
    })

  return (
    <section className={styles.legalFaq} aria-labelledby="faq-pravni-title" id="prava-a-podminky">
      <header className={styles.head}>
        <span className="faqEyebrow">Práva a podmínky · 04</span>
        <h2 id="faq-pravni-title">Zakázky, kurzy, poukazy a rozbité zásilky.</h2>
        <p>
          Krátké odpovědi na to, co platí podle obchodních podmínek. Celé znění najdete v{" "}
          <a href={`/${countryCode}/smluvni-podminky`}>obchodních podmínkách</a>.
        </p>
      </header>

      <div className={styles.groups}>
        {LEGAL_FAQ.map((group) => (
          <div key={group.id} className={styles.group} id={group.id}>
            <h3>{group.title}</h3>
            {group.items.map((item) => (
              <details key={item.id} id={item.id} className={styles.item}>
                <summary>
                  <span>{item.question}</span>
                  <i aria-hidden="true" />
                </summary>
                <div className={styles.answer}>
                  {item.answer.map((paragraph, index) => (
                    <p key={index}>{inline(paragraph)}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
