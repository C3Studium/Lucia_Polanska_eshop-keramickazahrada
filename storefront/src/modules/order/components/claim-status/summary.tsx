import {
  CLAIM_KIND_LABEL,
  CLAIM_STATUS_LABEL,
  RESOLUTION_LABEL,
  claimExpectsGoods,
  formatClaimDate,
  isFinalClaimStatus,
  type OrderClaim,
  type OrderClaims,
} from "@lib/util/claims"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Kompaktní „Reklamace a vrácení" na potvrzení objednávky: ke každé žádosti
 * druh, stav a jedna věta, co se právě děje, plus odkaz na stránku se vším
 * (časová osa, protokol, adresa pro vrácení, číslo zásilky). Serverová
 * komponenta — nic neklikatelného kromě odkazu.
 */
const headline = (claim: OrderClaim) => {
  switch (claim.status) {
    case "pending":
      return claim.resolve_by
        ? `Posuzujeme — vyřídíme do ${formatClaimDate(claim.resolve_by)}.`
        : "Posuzujeme."
    case "approved":
      return claimExpectsGoods(claim)
        ? "Schváleno — čekáme na zboží. Adresu najdete v detailu."
        : claim.resolution
          ? `Schváleno — ${RESOLUTION_LABEL[claim.resolution].toLowerCase()}.`
          : "Schváleno."
    case "received":
      return "Zboží k nám dorazilo, kontrolujeme."
    case "resolved":
      return `Vyřízeno ${formatClaimDate(claim.resolved_at)}${
        claim.resolution ? ` — ${RESOLUTION_LABEL[claim.resolution].toLowerCase()}` : ""
      }.`
    case "rejected":
      return "Zamítnuto — odůvodnění najdete v detailu."
    case "cancelled":
      return "Žádost byla stornována."
  }
}

export default function ClaimsSummary({
  orderId,
  token,
  claims,
}: {
  orderId: string
  token: string
  claims: OrderClaims
}) {
  if (!claims.requests.length) return null
  const sorted = [...claims.requests].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
  )
  const hasOpen = sorted.some((claim) => !isFinalClaimStatus(claim.status))

  return (
    <section className={styles.summary} aria-label="Reklamace a vrácení">
      <div className={styles.summaryHead}>
        <span className={styles.eyebrow}>Reklamace a vrácení</span>
        <LocalizedClientLink
          className={styles.summaryLink}
          href={`/order/${orderId}/claims?token=${token}`}
        >
          Podrobnosti <i aria-hidden="true">↗</i>
        </LocalizedClientLink>
      </div>
      <ul className={styles.summaryList}>
        {sorted.map((claim) => (
          <li
            key={claim.id}
            className={styles.summaryItem}
            data-status={claim.status}
          >
            <span className={styles.dot} aria-hidden="true" />
            <div>
              <strong>
                {CLAIM_KIND_LABEL[claim.kind]} · {CLAIM_STATUS_LABEL[claim.status]}
              </strong>
              <p>{headline(claim)}</p>
            </div>
          </li>
        ))}
      </ul>
      {/* Další žádost jde podat, až je ta předchozí uzavřená (server povolí
          jen jednu otevřenou). */}
      {!hasOpen && (
        <LocalizedClientLink
          className={styles.summaryGhost}
          href={`/order/${orderId}/refund?token=${token}`}
        >
          Podat další žádost
        </LocalizedClientLink>
      )}
    </section>
  )
}
