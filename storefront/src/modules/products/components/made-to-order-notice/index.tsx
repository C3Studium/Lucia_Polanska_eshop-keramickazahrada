"use client"

import { madeToOrderBadgeText } from "@lib/util/made-to-order"
import { LEGAL_LINKS } from "@modules/checkout/components/legal-consent/labels"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Poučení u zakázkové výroby na stránce produktu (audit § 2 a § 0, § 1820
 * odst. 1 písm. j) OZ): výjimka z práva odstoupit (§ 1837 písm. d) OZ) a
 * nevratnost zálohy po zahájení výroby (Z5) platí jen tehdy, když o nich
 * zákazník ví PŘEDEM — proto přímo u ceny, ne až v záložce „Doprava a
 * vrácení". V pokladně to pak ještě potvrdí zaškrtnutím (Z10).
 *
 * Zobrazuje se u produktu se zapnutým profilem výroby NEBO v kategorii
 * Zakázková výroba (dnes se ty dvě sady nepřekrývají, viz `lib/util/commission`).
 * Záloha a lhůta jsou z profilu — bez profilu se vynechají, nic se nevymýšlí.
 */

const TERMS_ANCHOR = LEGAL_LINKS.termsMadeToOrder

type TermsProps = {
  /** Záloha v % z profilu výroby (přepis u provedení má přednost). */
  depositPercentage?: number | null
  /** Nejdelší lhůta ve dnech od zahájení výroby (Z9). */
  maxDays?: number | null
}

/** Štítek pod cenou: „Na zakázku · záloha 25 % · výroba do 42 dnů · nelze vrátit do 14 dnů". */
export function MadeToOrderBadge({ depositPercentage, maxDays }: TermsProps) {
  return (
    <LocalizedClientLink
      href={TERMS_ANCHOR}
      className={styles.badge}
      title="Výrobek podle vašeho zadání nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) občanského zákoníku) a záloha se po zahájení výroby nevrací. Více v obchodních podmínkách."
      target="_blank"
      rel="noopener"
      data-testid="made-to-order-badge"
    >
      {madeToOrderBadgeText({ depositPercentage, maxDays })}
    </LocalizedClientLink>
  )
}

/** Věta u tlačítka „Přidat do košíku". */
export function MadeToOrderAddNotice() {
  return (
    <p className={styles.notice} data-testid="made-to-order-add-notice">
      Tenhle kus vyrobíme na zakázku přímo pro vás, a proto ho nelze vrátit ve
      14denní lhůtě (§ 1837 písm. d) OZ); záloha se po zahájení výroby nevrací.
      Před odesláním objednávky to ještě potvrdíte. Podrobnosti v{" "}
      <LocalizedClientLink href={TERMS_ANCHOR} target="_blank" rel="noopener">
        obchodních podmínkách
      </LocalizedClientLink>
      .
    </p>
  )
}

/**
 * Čtyři kroky zakázky — totéž, co bod 05 PDF Potvrzení zakázky
 * (`potvrzeni-zakazky.html`), aby zákazník četl před objednávkou to, co pak
 * dostane v příloze. Lhůta dokončení jen s profilem (Z9); bez něj krok říká,
 * že lhůta bude v potvrzení zakázky.
 */
export const madeToOrderSteps = (maxDays?: number | null) => [
  {
    title: "Zahájení výroby",
    text: "Začneme po připsání platby. V den, kdy začneme, vám pošleme e-mail „Zakázka je ve výrobě“ s datem a časem — od něj je výroba zahájena.",
  },
  {
    title: "Dokončení",
    text: maxDays
      ? `Do ${maxDays} dnů od zahájení výroby. Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu.`
      : "Lhůtu od zahájení výroby najdete v potvrzení zakázky. Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu.",
  },
  {
    title: "Schválení před výpalem",
    text: "Pošleme vám fotografii hotového tvaru. Máte 5 pracovních dnů (připomeneme se). Schválená podoba je ujednanou vlastností výrobku; nesoulad se zadáním zůstává vadou vždy.",
  },
  {
    title: "Odeslání",
    text: "Do 2 pracovních dnů od doplatku, pojištěný křehký balík — nebo vám dáme vědět, že je kus připravený k vyzvednutí.",
  },
]

/** Blok „Jak zakázka probíhá" pod tlačítkem. */
export function MadeToOrderSteps({ maxDays }: Pick<TermsProps, "maxDays">) {
  return (
    <section
      className={styles.steps}
      aria-labelledby="made-to-order-steps-title"
      data-testid="made-to-order-steps"
    >
      <p id="made-to-order-steps-title" className={styles.stepsTitle}>
        Jak zakázka probíhá
      </p>
      <ol className={styles.stepsList}>
        {madeToOrderSteps(maxDays).map((step) => (
          <li key={step.title}>
            <strong>{step.title}.</strong> {step.text}
          </li>
        ))}
      </ol>
      <p className={styles.stepsTerms}>
        Zrušíte-li zakázku před zahájením výroby, vrátíme vám všechno; po
        zahájení se záloha nevrací, zbytek ano. Celé znění v{" "}
        <LocalizedClientLink href={TERMS_ANCHOR} target="_blank" rel="noopener">
          obchodních podmínkách, čl. Výroba na zakázku
        </LocalizedClientLink>
        .
      </p>
    </section>
  )
}

/** Stejná věta pro panel „Vyrábí se na zakázku" (`MadeToOrderPanel`). */
export const MADE_TO_ORDER_NO_RETURN =
  "Zboží vyrobené na zakázku nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) OZ); záloha se po zahájení výroby nevrací."
