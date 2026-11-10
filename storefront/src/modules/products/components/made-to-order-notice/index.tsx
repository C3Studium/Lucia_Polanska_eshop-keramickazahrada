"use client"

import { madeToOrderBadgeText } from "@lib/util/made-to-order"
import { LEGAL_LINKS } from "@modules/checkout/components/legal-consent/labels"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useTexty } from "@lib/context/texty"
import {
  TEXTY_DEFAULTS,
  dosadZnacky,
  slozStitek,
  type ShopTexty,
} from "@lib/constants/texty"

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
  /** Cena po domluvě — procento zálohy se neuvádí, není z čeho počítat. */
  priceOnRequest?: boolean
}

/**
 * Štítek pod cenou: „Na zakázku · záloha 25 % · výroba do 42 dnů · bez
 * 14denní lhůty na vrácení".
 */
export function MadeToOrderBadge({
  depositPercentage,
  maxDays,
  priceOnRequest,
}: TermsProps) {
  /* Skladba štítku i jeho části se mění v administraci; prázdná část
     z řádku sama vypadne (`slozStitek`). */
  const texty = useTexty()
  const zaloha = priceOnRequest
    ? texty["zakazka.stitek_zaloha_po_domluve"]
    : depositPercentage != null && depositPercentage > 0
      ? dosadZnacky(texty["zakazka.stitek_zaloha"], { procento: depositPercentage })
      : ""
  const vyroba =
    maxDays != null && maxDays > 0
      ? dosadZnacky(texty["zakazka.stitek_vyroba"], { dny: maxDays })
      : ""
  const popisek = slozStitek(texty["zakazka.stitek"], { zaloha, vyroba })

  if (!popisek) return null

  return (
    <LocalizedClientLink
      href={TERMS_ANCHOR}
      className={styles.badge}
      title="Výrobek podle vašeho zadání nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) občanského zákoníku) a záloha se po zahájení výroby nevrací. Více v obchodních podmínkách."
      target="_blank"
      rel="noopener"
      data-testid="made-to-order-badge"
    >
      {popisek}
    </LocalizedClientLink>
  )
}

/** Věta u tlačítka „Přidat do košíku". */
export function MadeToOrderAddNotice() {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
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
export const madeToOrderSteps = (
  maxDays?: number | null,
  texty: ShopTexty = TEXTY_DEFAULTS
) =>
  [
    {
      title: texty["zakazka.krok_zahajeni_nazev"],
      text: texty["zakazka.krok_zahajeni"],
    },
    {
      title: texty["zakazka.krok_dokonceni_nazev"],
      /* Lhůta se dosadí za `{{dny}}`; bez profilu platí znění bez lhůty —
         slibovat termín, který nikdo nezná, by bylo horší než mlčet. */
      text: maxDays
        ? dosadZnacky(texty["zakazka.krok_dokonceni"], { dny: maxDays })
        : texty["zakazka.krok_dokonceni_bez_lhuty"],
    },
    {
      title: texty["zakazka.krok_schvaleni_nazev"],
      text: texty["zakazka.krok_schvaleni"],
    },
    {
      title: texty["zakazka.krok_odeslani_nazev"],
      text: texty["zakazka.krok_odeslani"],
    },
    /* Vypnutý krok z výpisu zmizí celý — číslovaný seznam s prázdnou
       položkou vypadá jako chyba, ne jako rozhodnutí. */
  ].filter((step) => step.title || step.text)

/** Blok „Jak zakázka probíhá" pod tlačítkem. */
export function MadeToOrderSteps({ maxDays }: Pick<TermsProps, "maxDays">) {
  /* Znění kroků z administrace (Právní věci a texty → Texty obchodu) —
     právě tady se mění lhůta, která je na plastiky krátká. */
  const texty = useTexty()
  const kroky = madeToOrderSteps(maxDays, texty)
  const zruseni = texty["zakazka.kroky_zruseni"]
  const nadpis = texty["zakazka.kroky_nadpis"]

  /* Bez kroků i bez věty o zrušení není co ukazovat. */
  if (!kroky.length && !zruseni && !nadpis) return null

  return (
    <section
      className={styles.steps}
      aria-labelledby="made-to-order-steps-title"
      data-testid="made-to-order-steps"
    >
      {nadpis ? (
        <p id="made-to-order-steps-title" className={styles.stepsTitle}>
          {nadpis}
        </p>
      ) : null}
      {kroky.length ? (
        <ol className={styles.stepsList}>
          {kroky.map((step) => (
            <li key={step.title || step.text}>
              {step.title ? <strong>{step.title}.</strong> : null}{" "}
              {step.text}
            </li>
          ))}
        </ol>
      ) : null}
      {/* Odkaz na podmínky patří k té větě; bez ní nemá kde stát. */}
      {zruseni ? (
        <p className={styles.stepsTerms}>
          {zruseni}{" "}
          <LocalizedClientLink href={TERMS_ANCHOR} target="_blank" rel="noopener">
            {texty["products.made_to_order_notice_1"]}</LocalizedClientLink>
          .
        </p>
      ) : null}
    </section>
  )
}

/** Stejná věta pro panel „Vyrábí se na zakázku" (`MadeToOrderPanel`). */
export const MADE_TO_ORDER_NO_RETURN =
  "Zboží vyrobené na zakázku nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) OZ); záloha se po zahájení výroby nevrací."
