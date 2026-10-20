"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  loadCommissionCancellation,
  submitCommissionCancellation,
} from "@lib/data/commission-cancellation"
import {
  cancelledCommissionText,
  commissionCancelCopy,
  commissionStatusLabel,
  type CommissionBalance,
  type CommissionCancellation,
} from "@lib/util/made-to-order"
import { convertToLocale } from "@lib/util/money"
import { LEGAL_LINKS } from "@modules/checkout/components/legal-consent/labels"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import s from "./style.module.scss"

type Props = {
  orderId: string
  /** `GET …/balance` — stav zakázky; `is_commission:false` / null → panel se nevykreslí. */
  balance: CommissionBalance | null
  /**
   * `GET …/cancellation` načtené serverem. `undefined` = stránka ho nenačítala
   * → panel si ho dotáhne sám; `null` = načíst se nepovedlo → zrušení se nenabídne.
   */
  cancellation?: CommissionCancellation | null
  /** Podepsaný self-service token (host z e-mailu). Přihlášený ho nepotřebuje. */
  token?: string | null
  className?: string
}

/**
 * Panel zakázky na stránkách objednávky (audit § 0, Z3–Z5, Z11): stav podle
 * e-mailu „Zakázka je ve výrobě", smluvní záloha, PDF Potvrzení zakázky a
 * tlačítko „Zrušit zakázku".
 *
 * Zrušení je PŘED e-mailem o zahájení jednokrokové — vrací se vše (Z4), není
 * co rozmýšlet. PO něm dvoukrokové: první klik ukáže, že záloha se nevrací a
 * kolik se vrátí (Z5), teprve „Ano, zrušit zakázku" zakázku zruší. Fázi i
 * částky říká backend; storefront je jen opíše. `can_cancel:false` → tlačítko
 * není, místo něj backendův důvod.
 *
 * Doplatek (tlačítko „Doplatit") zůstává v `BalancePayPanel` hned pod tímhle.
 */
export default function CommissionPanel({
  orderId,
  balance,
  cancellation: initialCancellation,
  token = null,
  className,
}: Props) {
  const router = useRouter()
  const [facts, setFacts] = useState<CommissionBalance | null>(balance)
  const [cancellation, setCancellation] = useState<
    CommissionCancellation | null | undefined
  >(initialCancellation)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isCommission = Boolean(balance?.is_commission)

  /* Stránka, která cancellation nenačetla (undefined), ho dostane odsud — ať
     panel funguje všude, kde je `balance`, bez úprav každé stránky. */
  useEffect(() => {
    if (!isCommission || initialCancellation !== undefined) return
    let cancelled = false
    loadCommissionCancellation(orderId, token)
      .then((result) => {
        if (!cancelled) setCancellation(result)
      })
      .catch(() => {
        if (!cancelled) setCancellation(null)
      })
    return () => {
      cancelled = true
    }
  }, [isCommission, initialCancellation, orderId, token])

  if (!isCommission || !facts) return null

  const currency = facts.currency_code ?? cancellation?.currency_code ?? "czk"
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currency })

  const isCancelled =
    facts.stage === "cancelled" || Boolean(facts.cancellation_phase)
  const status = commissionStatusLabel(facts)

  const cancel = () => {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const outcome = await submitCommissionCancellation(orderId, { token })
      if (!outcome.success) {
        setError(outcome.message)
        return
      }
      /* Lokálně přepnout na „Zrušeno" hned — refresh stránky dotáhne zbytek
         (stav v hlavičce, doplatek zmizí). */
      setFacts((current) =>
        current
          ? {
              ...current,
              stage: "cancelled",
              cancellation_phase: outcome.result.phase,
              cancelled_by: "customer",
              cancellation_refund_amount: outcome.result.refund_amount,
              pay_url: null,
              outstanding: 0,
            }
          : current
      )
      setConfirming(false)
      router.refresh()
    })
  }

  const copy =
    cancellation && cancellation.can_cancel && !isCancelled
      ? commissionCancelCopy(cancellation, money)
      : null

  return (
    <section
      className={className ? `${s.root} ${className}` : s.root}
      aria-label="Zakázka"
      data-testid="commission-panel"
      data-state={isCancelled ? "cancelled" : facts.production_start_notified_at ? "in_production" : "waiting"}
    >
      <p className={s.eyebrow}>Zakázková výroba</p>

      <dl className={s.rows}>
        <div className={s.row}>
          <dt>Stav</dt>
          <dd data-testid="commission-status">{status}</dd>
        </div>
        {typeof facts.deposit_amount === "number" && facts.deposit_amount > 0 && (
          <div className={s.row}>
            <dt>Smluvní záloha</dt>
            <dd>
              {typeof facts.deposit_percentage === "number" &&
              facts.deposit_percentage > 0
                ? `${facts.deposit_percentage} % · ${money(facts.deposit_amount)}`
                : money(facts.deposit_amount)}
            </dd>
          </div>
        )}
        {typeof facts.production_time_max_days === "number" &&
          facts.production_time_max_days > 0 &&
          !isCancelled && (
            <div className={s.row}>
              <dt>Lhůta</dt>
              <dd>do {facts.production_time_max_days} dnů od zahájení výroby</dd>
            </div>
          )}
      </dl>

      {facts.confirmation_pdf_url && (
        <a
          className={s.docLink}
          href={facts.confirmation_pdf_url}
          target="_blank"
          rel="noopener"
          data-testid="commission-confirmation-pdf"
        >
          Potvrzení zakázky (PDF) <i aria-hidden="true">↗</i>
        </a>
      )}

      {isCancelled ? (
        <p className={s.note} data-testid="commission-cancelled">
          {cancelledCommissionText(facts, money)}
        </p>
      ) : copy ? (
        <div className={s.cancel}>
          {copy.steps === "single" ? (
            <>
              {/* Z4 — před zahájením výroby se vrací vše: jeden klik. */}
              <p className={s.note}>{copy.lead}</p>
              <button
                type="button"
                className={s.cancelBtn}
                onClick={cancel}
                disabled={pending}
                data-testid="commission-cancel"
              >
                {pending ? "Rušíme…" : copy.button}
              </button>
            </>
          ) : confirming ? (
            <>
              {/* Z5 — po zahájení výroby záloha propadá: nejdřív částky, pak
                  teprve potvrzení. */}
              <p className={s.note} data-testid="commission-cancel-confirm-text">
                {copy.lead}
              </p>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.confirmBtn}
                  onClick={cancel}
                  disabled={pending}
                  data-testid="commission-cancel-confirm"
                >
                  {pending ? "Rušíme…" : copy.confirm}
                </button>
                <button
                  type="button"
                  className={s.backBtn}
                  onClick={() => {
                    setConfirming(false)
                    setError(null)
                  }}
                  disabled={pending}
                >
                  Zpět
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className={s.cancelBtn}
              onClick={() => setConfirming(true)}
              data-testid="commission-cancel"
            >
              {copy.button}
            </button>
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </div>
      ) : cancellation && !cancellation.can_cancel && cancellation.blocked_reason ? (
        <p className={s.note} data-testid="commission-cancel-blocked">
          {cancellation.blocked_reason}
        </p>
      ) : null}

      <p className={s.terms}>
        Pravidla zakázky — záloha, lhůta, zrušení — jsou v{" "}
        <LocalizedClientLink
          href={LEGAL_LINKS.termsMadeToOrder}
          target="_blank"
          rel="noopener"
        >
          obchodních podmínkách
        </LocalizedClientLink>
        .
      </p>
    </section>
  )
}
