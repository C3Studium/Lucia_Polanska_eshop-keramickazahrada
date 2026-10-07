"use client"

import { useId, useState, type ReactNode } from "react"

import { submitClaimTracking } from "@lib/data/claims"
import {
  CLAIM_KIND_LABEL,
  CLAIM_STATUS_LABEL,
  REQUESTED_RESOLUTION_LABEL,
  RESOLUTION_LABEL,
  claimExpectsGoods,
  formatClaimDate,
  isFinalClaimStatus,
  type OrderClaim,
  type OrderClaims,
} from "@lib/util/claims"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Stav žádostí (reklamace / vrácení / odstoupení) pro zákazníka — časová osa
 * ke každé žádosti: Přijato → Rozhodnuto → Zboží přijato → Vyřízeno. Data
 * jsou z `GET /store/orders/:id/claims` (token), nic se tu nedopočítává.
 *
 * U schválené žádosti, kde se čeká na zboží, ukáže adresu a pokyny pro
 * vrácení (z nastavení majitelky) a pole „číslo zásilky, kterou jsem poslal/a"
 * → `POST …/claims/:claimId/tracking`.
 */
type Props = {
  orderId: string
  token: string
  claims: OrderClaims
  /** Měna objednávky pro částky refundací; výchozí koruny. */
  currencyCode?: string
  /** Jen tyto žádosti (např. jediná otevřená ve formuláři); výchozí všechny. */
  only?: OrderClaim[]
  /** Odkaz „všechny žádosti" pod výpisem (ve formuláři, kde je jen ta otevřená). */
  showAllLink?: boolean
}

type StepTone = "done" | "current" | "upcoming" | "rejected"

type Step = {
  key: string
  label: string
  date?: string | null
  tone: StepTone
  note?: ReactNode
}

const money = (amount: number, currencyCode: string) =>
  convertToLocale({ amount, currency_code: currencyCode })

/** Kroky časové osy jedné žádosti — co se stalo, co se právě děje, co přijde. */
const buildSteps = (claim: OrderClaim, currencyCode: string): Step[] => {
  const steps: Step[] = [
    {
      key: "received",
      label: "Přijato",
      date: claim.created_at,
      tone: "done",
    },
  ]

  if (claim.status === "pending") {
    steps.push({
      key: "decision",
      label: "Posuzujeme",
      tone: "current",
      note: claim.resolve_by
        ? `Vyřídíme do ${formatClaimDate(claim.resolve_by)}.`
        : undefined,
    })
    if (claimExpectsGoods(claim)) {
      steps.push({ key: "goods", label: "Zboží přijato", tone: "upcoming" })
    }
    steps.push({ key: "resolved", label: "Vyřízeno", tone: "upcoming" })
    return steps
  }

  if (claim.status === "rejected") {
    steps.push({
      key: "decision",
      label: "Zamítnuto",
      tone: "rejected",
      note: claim.decision_note ? (
        <>
          <strong>Odůvodnění:</strong> {claim.decision_note}
        </>
      ) : undefined,
    })
    return steps
  }

  if (claim.status === "cancelled") {
    steps.push({
      key: "decision",
      label: "Žádost stornována",
      tone: "rejected",
      note: claim.decision_note || undefined,
    })
    return steps
  }

  // approved / received / resolved
  steps.push({
    key: "decision",
    label: "Schváleno",
    tone: "done",
    note: claim.resolution
      ? `Způsob vyřízení: ${RESOLUTION_LABEL[claim.resolution]}.`
      : undefined,
  })

  const expectsGoods = claimExpectsGoods(claim)
  if (claim.goods_received_at) {
    steps.push({
      key: "goods",
      label: "Zboží přijato",
      date: claim.goods_received_at,
      tone: "done",
    })
  } else if (expectsGoods && claim.status === "approved") {
    steps.push({
      key: "goods",
      label: "Čekáme na zboží",
      tone: "current",
    })
  }

  if (claim.status === "resolved") {
    const refunded = claim.refund_amount ?? 0
    steps.push({
      key: "resolved",
      label: "Vyřízeno",
      date: claim.resolved_at,
      tone: "done",
      note: (
        <>
          {claim.resolution ? RESOLUTION_LABEL[claim.resolution] : "Vyřízeno"}
          {refunded > 0 ? ` — vráceno ${money(refunded, currencyCode)}` : ""}
          .
        </>
      ),
    })
  } else {
    steps.push({
      key: "resolved",
      label: "Vyřízeno",
      tone: claim.status === "received" ? "current" : "upcoming",
      note:
        claim.status === "received"
          ? claim.resolve_by
            ? `Kontrolujeme — vyřídíme do ${formatClaimDate(claim.resolve_by)}.`
            : "Kontrolujeme."
          : claim.resolve_by
            ? `Vyřídíme do ${formatClaimDate(claim.resolve_by)}.`
            : undefined,
    })
  }

  return steps
}

function TrackingForm({
  orderId,
  token,
  claim,
}: {
  orderId: string
  token: string
  claim: OrderClaim
}) {
  const [saved, setSaved] = useState<string | null>(claim.goods_tracking)
  const [editing, setEditing] = useState(!claim.goods_tracking)
  const [value, setValue] = useState(claim.goods_tracking ?? "")
  const [state, setState] = useState<"idle" | "sending" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()

  const send = async () => {
    const tracking = value.trim()
    if (!tracking || state === "sending") return
    setState("sending")
    setError(null)
    const result = await submitClaimTracking(orderId, token, claim.id, tracking)
    if ("error" in result) {
      setState("error")
      setError(result.error)
      return
    }
    setState("idle")
    setSaved(tracking)
    setEditing(false)
  }

  if (saved && !editing) {
    return (
      <p className={styles.trackingSaved} role="status">
        Číslo zásilky: <strong>{saved}</strong>
        <button
          type="button"
          className={styles.linklike}
          onClick={() => setEditing(true)}
        >
          Změnit
        </button>
      </p>
    )
  }

  return (
    <div className={styles.tracking}>
      <label htmlFor={fieldId} className={styles.trackingLabel}>
        Číslo zásilky, kterou jsem poslal/a <i>(nepovinné)</i>
      </label>
      <div className={styles.trackingRow}>
        <input
          id={fieldId}
          className={styles.trackingInput}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="např. DR1234567890C"
          disabled={state === "sending"}
        />
        <button
          type="button"
          className={styles.trackingSubmit}
          onClick={send}
          disabled={!value.trim() || state === "sending"}
        >
          {state === "sending" ? "Ukládám…" : "Uložit"}
        </button>
        {saved && (
          <button
            type="button"
            className={styles.linklike}
            onClick={() => {
              setEditing(false)
              setValue(saved)
            }}
          >
            Zpět
          </button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function ClaimCard({
  orderId,
  token,
  claim,
  claims,
  currencyCode,
}: {
  orderId: string
  token: string
  claim: OrderClaim
  claims: OrderClaims
  currencyCode: string
}) {
  const steps = buildSteps(claim, currencyCode)
  const final = isFinalClaimStatus(claim.status)
  const showReturnBlock =
    claim.status === "approved" && claimExpectsGoods(claim)
  const goodsLead =
    claim.kind === "reklamace"
      ? claim.resolution === "replace"
        ? "Pošlete nám prosím zboží k výměně na adresu:"
        : "Pošlete nám prosím zboží k opravě na adresu:"
      : "Pošlete nám prosím zboží zpět na adresu:"

  return (
    <article
      className={styles.card}
      data-status={claim.status}
      aria-label={`${CLAIM_KIND_LABEL[claim.kind]} — ${CLAIM_STATUS_LABEL[claim.status]}`}
    >
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.eyebrow}>{CLAIM_KIND_LABEL[claim.kind]}</span>
          <strong className={styles.status}>
            {CLAIM_STATUS_LABEL[claim.status]}
          </strong>
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>Podáno</dt>
            <dd>{formatClaimDate(claim.created_at)}</dd>
          </div>
          {claim.kind === "reklamace" && claim.requested_resolution && (
            <div>
              <dt>Požadujete</dt>
              <dd>{REQUESTED_RESOLUTION_LABEL[claim.requested_resolution]}</dd>
            </div>
          )}
          {!final && claim.resolve_by && (
            <div>
              <dt>Vyřídíme do</dt>
              <dd>{formatClaimDate(claim.resolve_by)}</dd>
            </div>
          )}
        </dl>
      </header>

      <ol className={styles.timeline}>
        {steps.map((step) => (
          <li key={step.key} className={styles.step} data-tone={step.tone}>
            <span className={styles.dot} aria-hidden="true" />
            <div className={styles.stepBody}>
              <span className={styles.stepLabel}>
                {step.label}
                {step.date && (
                  <time dateTime={step.date} className={styles.stepDate}>
                    {formatClaimDate(step.date)}
                  </time>
                )}
              </span>
              {step.note && <p className={styles.stepNote}>{step.note}</p>}
            </div>
          </li>
        ))}
      </ol>

      {showReturnBlock && (
        <div className={styles.returnBlock}>
          <p className={styles.returnLead}>{goodsLead}</p>
          <address className={styles.returnAddress}>
            {claims.return_address}
          </address>
          {claims.return_instructions && (
            <p className={styles.returnInstructions}>
              {claims.return_instructions}
            </p>
          )}
          <TrackingForm orderId={orderId} token={token} claim={claim} />
        </div>
      )}

      {/* Uložené číslo zásilky i po přijetí zboží — ať zákazník vidí, že
          dorazila ta jeho. */}
      {!showReturnBlock && claim.goods_tracking && (
        <p className={styles.trackingSaved}>
          Číslo zásilky: <strong>{claim.goods_tracking}</strong>
        </p>
      )}

      {(claim.reason || claim.protocol_url) && (
        <footer className={styles.cardFoot}>
          {claim.reason && (
            <p className={styles.reason}>
              <span>Vaše zpráva:</span> {claim.reason}
            </p>
          )}
          {claim.protocol_url && (
            <a
              className={styles.protocol}
              href={claim.protocol_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Protokol (PDF) <i aria-hidden="true">↗</i>
            </a>
          )}
        </footer>
      )}
    </article>
  )
}

export default function ClaimStatus({
  orderId,
  token,
  claims,
  currencyCode = "czk",
  only,
  showAllLink = false,
}: Props) {
  const requests = only ?? claims.requests
  // Nejnovější nahoře.
  const sorted = [...requests].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
  )

  if (sorted.length === 0) {
    return (
      <div className={styles.root}>
        <p className={styles.empty}>
          K této objednávce zatím žádnou reklamaci ani vrácení nemáme.
        </p>
        <LocalizedClientLink
          className={styles.cta}
          href={`/order/${orderId}/refund?token=${token}`}
        >
          Podat žádost
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {sorted.map((claim) => (
        <ClaimCard
          key={claim.id}
          orderId={orderId}
          token={token}
          claim={claim}
          claims={claims}
          currencyCode={currencyCode}
        />
      ))}
      {showAllLink && (
        <LocalizedClientLink
          className={styles.allLink}
          href={`/order/${orderId}/claims?token=${token}`}
        >
          Všechny žádosti k objednávce
        </LocalizedClientLink>
      )}
    </div>
  )
}
