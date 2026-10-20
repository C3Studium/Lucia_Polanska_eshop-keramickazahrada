import {
  withdrawalEntryState,
  type OrderClaims,
} from "@lib/util/claims"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Vstup do odstoupení od smlouvy online (§ 1830a OZ) — tlačítko
 * „Odstoupit od smlouvy", dostupné nepřetržitě od objednání do 14 dnů po
 * převzetí. Mimo lhůtu (nebo u zakázky, zrušené objednávky, běžícího
 * odstoupení) místo tlačítka věta s vysvětlením — rozhoduje server
 * (`can_withdraw` + `withdraw_block_code` z `GET …/claims`).
 *
 * Bez hooků a bez `"use client"`: vykreslí ho serverové potvrzení objednávky
 * i klientská stránka účtu.
 */

/** Odkaz na stránku odstoupení s podepsaným tokenem (bez tokenu ji otevře jen přihlášený vlastník). */
export const withdrawalHref = (orderId: string, token?: string | null) =>
  token
    ? `/order/${orderId}/odstoupeni?token=${encodeURIComponent(token)}`
    : `/order/${orderId}/odstoupeni`

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
  const state = withdrawalEntryState(claims)
  const basis = claims.withdrawal?.takeover_basis ?? claims.takeover_basis
  const claimsHref = token
    ? `/order/${orderId}/claims?token=${encodeURIComponent(token)}`
    : null
  const claimHref = token
    ? `/order/${orderId}/refund?token=${encodeURIComponent(token)}&kind=reklamace`
    : null

  const lead =
    state.kind === "available"
      ? basis === "not_shipped" || basis === "in_transit"
        ? "Rozmysleli jste si to? Od smlouvy můžete odstoupit bez udání důvodu už teď — i před doručením. Lhůta 14 dnů poběží od převzetí zboží."
        : state.deadlineText
          ? `Od smlouvy můžete odstoupit bez udání důvodu do ${state.deadlineText} (14 dnů od převzetí zboží).`
          : "Od smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí zboží."
      : state.text

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
          <a href="mailto:info@keramickazahrada.cz">info@keramickazahrada.cz</a>
        </p>
      )}
    </section>
  )
}
