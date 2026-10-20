import { getLegalFacts } from "@lib/data/legal-facts"
import { getPublishedLegalRegistry } from "@lib/data/legal-registry"
import { fact } from "@lib/legal/facts"
import { LEGAL_PATHS } from "@lib/legal/registry"

import InquiryForm from "./form"
import styles from "./style.module.scss"

/**
 * Poptávka zakázky — poslední sekce stránky Výroba (LEGAL_AUDIT.md §6
 * „Stránka Výroba": odkaz „Zakázková tvorba" z domovské stránky vedl jen na
 * popis procesu, ne na poptávku).
 *
 * Kotva `#poptavka` (`INQUIRY_ANCHOR`) — na ni má mířit tlačítko z domovské
 * stránky: `/vyroba#poptavka`.
 *
 * Serverová komponenta schválně: verze OP (`currentTermsVersion()` z
 * publikovaného sloučeného registru — repo + Studio) a cesty k dokumentům se
 * berou tady a do klientského formuláře jdou jako hodnoty, kontakt z právních
 * údajů v administraci obchodu. Import registru v klientu by do balíčku
 * stáhl texty všech právních dokumentů.
 *
 * Texty jsou v kódu, ne v CMS: jde o předsmluvní informace k zakázce
 * (poučení o § 1837 písm. d) OZ, kdy vzniká smlouva), které musí sedět
 * s verzí OP — stejný důvod, proč CMS u právních stránek nepoužíváme
 * (docs/legal/00-plan.md §1).
 */

export const INQUIRY_ANCHOR = "poptavka"

const STEPS = [
  {
    title: "Poptávka",
    text: "Popíšete, co si představujete, a klidně přiložíte fotku místa, kam to přijde.",
  },
  {
    title: "Nabídka",
    text: "Pošlu vám nabídku s cenou, dodací lhůtou a výší zálohy.",
  },
  {
    title: "Potvrzení",
    text: "Smlouva vzniká, až nabídku potvrdíte nebo zaplatíte zálohu. Do té doby vás poptávka k ničemu nezavazuje.",
  },
  {
    title: "Výroba",
    text: "Po připsání zálohy se pustím do práce. V den zahájení vám přijde e-mail „Zakázka je ve výrobě“ — od něj běží výrobní lhůta a od něj se záloha při zrušení nevrací.",
  },
] as const

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

export default async function VyrobaInquiry() {
  const [registry, facts] = await Promise.all([getPublishedLegalRegistry(), getLegalFacts()])
  const termsVersion = registry.currentTermsVersion()
  const termsHref = `${LEGAL_PATHS["obchodni-podminky"]}#vyroba-na-zakazku`
  const privacyHref = LEGAL_PATHS["ochrana-osobnich-udaju"]
  const email = fact("seller.email", facts) ?? ""
  const phone = fact("seller.phone", facts)

  return (
    <section
      id={INQUIRY_ANCHOR}
      className={styles.section}
      data-scroll-section
      data-scroll-label="Poptávka"
      aria-labelledby="poptavka-title"
    >
      <header className={styles.meta}>
        <span>09 · Poptávka</span>
        <i aria-hidden="true" />
        <span>Zakázka na míru</span>
      </header>

      <div className={styles.layout}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Zakázková tvorba</p>
          <h2 id="poptavka-title" className={styles.title}>
            Máte vlastní představu?{" "}
            <em>Napište mi ji.</em>
          </h2>
          <p className={styles.lede}>
            Domovní číslo, znamení na dům, reliéf podle vašeho zadání — popište, co si
            představujete, a já vám pošlu nabídku.
          </p>

          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <aside className={styles.notice} aria-label="Důležité k zakázce na míru">
            <p>
              <strong>Zakázku na míru nelze vrátit do 14 dnů.</strong> Jde o zboží
              vyrobené podle vašeho zadání, u kterého zákon odstoupení od smlouvy
              ve 14denní lhůtě vylučuje (§ 1837 písm. d) občanského zákoníku). Výši
              zálohy (nejvýš 50 % ceny) uvidíte v nabídce — ještě než se rozhodnete.
              Zrušíte-li zakázku před zahájením výroby, vrátím vám vše; po zahájení
              se záloha nevrací, zbytek ano.
            </p>
          </aside>

          {email && (
            <p className={styles.contact}>
              Raději přímo? <a href={`mailto:${email}`}>{email}</a>
              {phone ? (
                <>
                  {" · "}
                  <a href={telHref(phone)}>{phone}</a>
                </>
              ) : null}
            </p>
          )}
        </div>

        <InquiryForm
          termsVersion={termsVersion}
          termsHref={termsHref}
          privacyHref={privacyHref}
          contactEmail={email}
        />
      </div>
    </section>
  )
}
