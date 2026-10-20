"use client"

import { useId, type ReactNode } from "react"

import { MADE_TO_ORDER_ACK_TEXT } from "@lib/util/made-to-order"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { LEGAL_LINKS } from "./labels"

import styles from "./style.module.scss"

/**
 * Souhlas před odesláním objednávky — jeden pro pokladnu (krok Přehled)
 * i pro rychlý nákup (krok Platba).
 *
 * - Souhlas s OP a poučením o odstoupení: zaškrtávátko, výchozí NEZAŠKRTNUTÉ
 *   (§ 1817 OZ — žádné předvyplněné souhlasy).
 * - U zakázkové výroby druhé, povinné zaškrtávátko: poučení, že výrobek
 *   podle zadání nelze vrátit do 14 dnů (§ 1837 písm. d) OZ) A že záloha se
 *   po zahájení výroby nevrací (audit § 0, Z5/Z10). Výjimka platí jen tehdy,
 *   když o ní zákazník ví PŘEDEM (§ 1820 odst. 1 písm. j) OZ).
 * - Osobní údaje: jen informační věta, ne zaškrtávátko — zpracování pro
 *   vyřízení objednávky stojí na plnění smlouvy, ne na souhlasu.
 *
 * Co se ke kterému zaškrtnutí uloží, řeší `recordCheckoutConsent` — tahle
 * komponenta jen drží stav, který jí předá rodič.
 */

/** Odkazy otevírá v nové záložce — rozdělaný Přehled ani zaškrtnutí se neztratí. */
const DocLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <LocalizedClientLink href={href} target="_blank" rel="noopener">
    {children}
  </LocalizedClientLink>
)

const TermsText = () => (
  <>
    Seznámil(a) jsem se s{" "}
    <DocLink href={LEGAL_LINKS.terms}>obchodními podmínkami</DocLink>{" "}
    a{" "}
    <DocLink href={LEGAL_LINKS.withdrawal}>
      poučením o odstoupení od smlouvy
    </DocLink>{" "}
    a souhlasím s nimi.
  </>
)

/*
 * Znění je PŘESNĚ to z auditu § 0 (Z10) a z PDF Potvrzení zakázky, bod 08 —
 * `MADE_TO_ORDER_ACK_TEXT`. Nevratnost zálohy po zahájení výroby je sankce,
 * která nesmí být jen v OP (§ 1753 OZ, ÚS I. ÚS 3512/11) — proto ji zákazník
 * zaškrtává výslovně. Odkaz na článek OP je mimo text zaškrtnutí, aby se
 * uložené znění shodovalo s PDF.
 */
const MadeToOrderText = () => (
  <>
    {MADE_TO_ORDER_ACK_TEXT}{" "}
    <DocLink href={LEGAL_LINKS.termsMadeToOrder}>
      Pravidla zakázky v obchodních podmínkách
    </DocLink>
    .
  </>
)

const PrivacyText = () => (
  <>
    Osobní údaje z objednávky zpracujeme, abychom ji mohli vyřídit a splnit
    povinnosti, které nám s ní ukládá zákon. Podrobnosti najdete v{" "}
    <DocLink href={LEGAL_LINKS.privacy}>
      zásadách ochrany osobních údajů
    </DocLink>
    .
  </>
)

type CheckoutConsentProps = {
  /** `review` = velké zaškrtávátko pokladny, `express` = styl rychlého nákupu. */
  variant: "review" | "express"
  accepted: boolean
  onAcceptedChange: (accepted: boolean) => void
  /** Košík obsahuje zakázkovou výrobu → druhé, povinné zaškrtávátko. */
  madeToOrder: boolean
  madeToOrderAccepted: boolean
  onMadeToOrderAcceptedChange: (accepted: boolean) => void
  /** Express: třída řádku (`label` se zaškrtávátkem), kterou už má jeho styl. */
  rowClassName?: string
}

export default function CheckoutConsent({
  variant,
  accepted,
  onAcceptedChange,
  madeToOrder,
  madeToOrderAccepted,
  onMadeToOrderAcceptedChange,
  rowClassName,
}: CheckoutConsentProps) {
  const termsId = useId()
  const madeToOrderId = useId()

  if (variant === "express") {
    return (
      <div className={styles.express}>
        <label className={rowClassName}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => onAcceptedChange(event.target.checked)}
            data-testid="express-terms-checkbox"
          />{" "}
          <span>
            <TermsText />
          </span>
        </label>
        {madeToOrder && (
          <label className={rowClassName}>
            <input
              type="checkbox"
              checked={madeToOrderAccepted}
              onChange={(event) =>
                onMadeToOrderAcceptedChange(event.target.checked)
              }
              data-testid="express-made-to-order-checkbox"
            />{" "}
            <span>
              <MadeToOrderText />
            </span>
          </label>
        )}
        <p className={styles.privacyCompact}>
          <PrivacyText />
        </p>
      </div>
    )
  }

  return (
    <div className={styles.review}>
      <div className={styles.consent}>
        {/* Input je v obalu, aby nebyl SOUROZENEC štítku: globální
            `input ~ label` (plovoucí popisky v globals.scss) by jinak štítek
            zmenšil na 10px — a tahle věta je záznam souhlasu. */}
        <span className={styles.consentBoxWrap}>
          <input
            id={termsId}
            type="checkbox"
            className={styles.consentBox}
            checked={accepted}
            onChange={(event) => onAcceptedChange(event.target.checked)}
            data-testid="terms-checkbox"
          />
        </span>
        <label htmlFor={termsId} className={styles.consentLabel}>
          <TermsText />
        </label>
      </div>

      {madeToOrder && (
        <div className={styles.consent}>
          <span className={styles.consentBoxWrap}>
            <input
              id={madeToOrderId}
              type="checkbox"
              className={styles.consentBox}
              checked={madeToOrderAccepted}
              onChange={(event) =>
                onMadeToOrderAcceptedChange(event.target.checked)
              }
              data-testid="made-to-order-checkbox"
            />
          </span>
          <label htmlFor={madeToOrderId} className={styles.consentLabel}>
            <MadeToOrderText />
          </label>
        </div>
      )}

      <p className={styles.privacy}>
        <PrivacyText />
      </p>
    </div>
  )
}
