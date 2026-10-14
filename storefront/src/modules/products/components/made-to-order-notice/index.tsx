"use client"

import { LEGAL_LINKS } from "@modules/checkout/components/legal-consent/labels"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Poučení u zakázkové výroby na stránce produktu (audit § 2, § 1820 odst. 1
 * písm. j) OZ): výjimka z práva odstoupit (§ 1837 písm. d) OZ) platí jen
 * tehdy, když o ní zákazník ví PŘEDEM — proto přímo u ceny, ne až v záložce
 * „Doprava a vrácení". V pokladně to pak ještě potvrdí zaškrtnutím.
 *
 * Zobrazuje se u produktu se zapnutým profilem výroby NEBO v kategorii
 * Zakázková výroba (dnes se ty dvě sady nepřekrývají, viz `lib/util/commission`).
 */

const TERMS_ANCHOR = LEGAL_LINKS.termsMadeToOrder

/** Štítek vedle ceny. */
export function MadeToOrderBadge() {
  return (
    <LocalizedClientLink
      href={TERMS_ANCHOR}
      className={styles.badge}
      title="Zboží vyrobené na zakázku nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) občanského zákoníku). Více v obchodních podmínkách."
      target="_blank"
      rel="noopener"
      data-testid="made-to-order-badge"
    >
      Na zakázku — nelze vrátit do 14 dnů
    </LocalizedClientLink>
  )
}

/** Věta u tlačítka „Přidat do košíku". */
export function MadeToOrderAddNotice() {
  return (
    <p className={styles.notice} data-testid="made-to-order-add-notice">
      Tenhle kus vyrobíme na zakázku přímo pro vás, a proto ho nelze vrátit ve
      14denní lhůtě (§ 1837 písm. d) OZ). Před odesláním objednávky to ještě
      potvrdíte. Podrobnosti v{" "}
      <LocalizedClientLink href={TERMS_ANCHOR} target="_blank" rel="noopener">
        obchodních podmínkách
      </LocalizedClientLink>
      .
    </p>
  )
}

/** Stejná věta pro panel „Vyrábí se na zakázku" (`MadeToOrderPanel`). */
export const MADE_TO_ORDER_NO_RETURN =
  "Zboží vyrobené na zakázku nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) OZ)."
