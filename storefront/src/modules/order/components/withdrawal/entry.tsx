"use client"

import {
  withdrawalEntryState,
  type OrderClaims,
} from "@lib/util/claims"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ContactEmailLink from "@modules/common/components/contact-email"

import styles from "./style.module.scss"
import { useTexty } from "@lib/context/texty"
import { withdrawalLead } from "@lib/util/withdrawal-lead"
import { withdrawalHref } from "./href"

export { withdrawalHref }

/**
 * Vstup do odstoupení od smlouvy online (§ 1830a OZ) — tlačítko
 * „Odstoupit od smlouvy", dostupné nepřetržitě od objednání do 14 dnů po
 * převzetí. Mimo lhůtu (nebo u zakázky, zrušené objednávky, běžícího
 * odstoupení) místo tlačítka věta s vysvětlením — rozhoduje server
 * (`can_withdraw` + `withdraw_block_code` z `GET …/claims`).
 *
 * Klientská komponenta (13. 11. 2026): dřív `async` se `getTexty()`, jenže
 * ji vykreslují jen klientské stránky (detail objednávky, reklamace,
 * odstoupení) — a serverová funkce volaná při prvním vykreslení klientského
 * stromu je zasekla úplně („Server Functions cannot be called during initial
 * render"). Věty teď bere z `useTexty()`.
 */

export default function WithdrawalEntry({
  orderId,
  token,
  claims,
  variant = "panel",
}: {
  orderId: string
  token?: string | null
  claims: OrderClaims
  /** `panel` = samostatný blok s nadpisem; `compact` = jen věta a tlačítko. */
  variant?: "panel" | "compact"
}) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const state = withdrawalEntryState(claims)
  const basis = claims.withdrawal?.takeover_basis ?? claims.takeover_basis
  const claimsHref = token
    ? `/order/${orderId}/claims?token=${encodeURIComponent(token)}`
    : null
  const claimHref = token
    ? `/order/${orderId}/refund?token=${encodeURIComponent(token)}&kind=reklamace`
    : null

  const lead = withdrawalLead(state, basis, texty as Record<string, string | undefined>)

  return (
    <section
      className={variant === "panel" ? styles.entry : styles.entryCompact}
      aria-label="Odstoupení od smlouvy"
      data-state={state.kind}
    >
      {variant === "panel" && (
        <p className={styles.entryEyebrow}>Odstoupení od smlouvy</p>
      )}
      <p className={styles.entryLead}>{lead}</p>
      {state.kind === "available" ? (
        <LocalizedClientLink
          className={styles.entryButton}
          href={withdrawalHref(orderId, token)}
        >
          Odstoupit od smlouvy
        </LocalizedClientLink>
      ) : (
        <p className={styles.entryLinks}>
          {state.code === "open_withdrawal" && claimsHref ? (
            <LocalizedClientLink href={claimsHref}>Stav odstoupení</LocalizedClientLink>
          ) : null}
          {(state.code === "made_to_order" || state.code === "expired") && claimHref ? (
            <LocalizedClientLink href={claimHref}>Reklamovat vadu</LocalizedClientLink>
          ) : null}
          {/* Klientská komponenta, ne hook — tenhle modul je bez „use client". */}
          <ContactEmailLink role="objednavky" />
        </p>
      )}
    </section>
  )
}
