"use client"

import {
  commissionsOf,
  commissionTitle,
  commissionTotalsOf,
  type CommissionBalance,
  type CommissionCancellation,
  type CommissionNote,
} from "@lib/util/made-to-order"
import { convertToLocale } from "@lib/util/money"
import BalancePayPanel from "@modules/order/components/balance-pay"
import CommissionConversation from "@modules/order/components/commission-conversation"
import CommissionPanel from "@modules/order/components/commission-panel"

import s from "./style.module.scss"

type Props = {
  orderId: string
  /** `GET …/balance`; `is_commission:false` / null → nic. */
  balance: CommissionBalance | null
  /**
   * `GET …/cancellation` načtené stránkou — platí pro JEDINOU zakázku (starý
   * tvar). U víc zakázek má každá svůj náhled v `cancellation_preview`, nebo
   * si ho panel dotáhne sám.
   */
  cancellation?: CommissionCancellation | null
  /** Podepsaný self-service token (host z e-mailu). */
  token?: string | null
  /**
   * Vlákno objednávky (`listCommissionNotes(orderId)`). `null` = není zakázka
   * / nenačteno → konverzace se nevykreslí.
   */
  notes?: CommissionNote[] | null
  /**
   * Vlákna PER ZAKÁZKA (id `production_order` → zápisy) u objednávky s víc
   * zakázkami. Zakázka bez záznamu dostane prázdné vlákno — popup si ho při
   * otevření stejně natáhne znovu.
   */
  notesById?: Record<string, CommissionNote[]> | null
  className?: string
}

/**
 * Zakázky objednávky (Z-A „zakázka = položka"): pro každou zakázku vlastní
 * panel (stav, smluvní záloha, lhůta, PDF, Zrušit), její doplatek a její
 * konverzace s ateliérem. U víc zakázek nad seznamem souhrn — kolik zakázek,
 * zaplaceno zálohami, zbývá doplatit dohromady (`totals` z backendu).
 *
 * S jednou zakázkou vypadá stránka jako dřív: jeden panel, jeden doplatek,
 * jedna konverzace — a `cancellation` od stránky se použije rovnou. Rozdíl
 * mezi starým a novým tvarem `/balance` řeší `commissionsOf`; tady už je vždy
 * seznam.
 */
export default function CommissionList({
  orderId,
  balance,
  cancellation,
  token = null,
  notes = null,
  notesById = null,
  className,
}: Props) {
  const commissions = commissionsOf(balance)
  if (!commissions.length) return null

  const many = commissions.length > 1
  const totals = commissionTotalsOf(balance)
  const currency = balance?.currency_code ?? commissions[0].currency_code ?? "czk"
  const money = (amount: number) => convertToLocale({ amount, currency_code: currency })
  const activeCount = commissions.filter(
    (item) => item.stage !== "cancelled" && !item.cancellation_phase
  ).length

  return (
    <div className={className ? `${s.root} ${className}` : s.root} data-testid="commission-list">
      {many && (
        <section className={s.summary} aria-label="Zakázky v objednávce" data-testid="commission-summary">
          <p className={s.eyebrow}>Zakázková výroba</p>
          <p className={s.count}>
            {commissions.length} zakázky v objednávce
            {activeCount !== commissions.length ? ` · ${activeCount} běží` : ""}
          </p>
          <dl className={s.rows}>
            {totals.deposit_paid > 0.005 && (
              <div className={s.row}>
                <dt>Zaplaceno zálohami</dt>
                <dd>{money(totals.deposit_paid)}</dd>
              </div>
            )}
            {totals.balance_paid > 0.005 && (
              <div className={s.row}>
                <dt>Doplaceno</dt>
                <dd>{money(totals.balance_paid)}</dd>
              </div>
            )}
            <div className={s.row}>
              <dt>Zbývá doplatit celkem</dt>
              <dd data-testid="commission-summary-outstanding">
                {totals.outstanding > 0.005 ? money(totals.outstanding) : "nic"}
              </dd>
            </div>
          </dl>
          <p className={s.hint}>
            Každá zakázka má svůj stav, zálohu a doplatek — níž po jedné.
          </p>
        </section>
      )}

      {commissions.map((commission, index) => {
        const key = commission.production_order_id ?? commission.line_item_id ?? String(index)
        const title = commissionTitle(commission)
        const thread = many
          ? commission.production_order_id
            ? notesById?.[commission.production_order_id] ?? (notes ? [] : null)
            : null
          : notes
        return (
          <div key={key} className={s.commission}>
            <CommissionPanel
              orderId={orderId}
              commission={commission}
              /* Stránkou načtené `cancellation` patří jen jediné zakázce;
                 u víc zakázek si každý panel vezme svůj náhled / dotaz. */
              cancellation={many ? undefined : cancellation}
              token={token}
              showItem={many}
            />
            <BalancePayPanel commission={commission} showTitle={many} />
            {thread && (
              <CommissionConversation
                orderId={orderId}
                notes={thread}
                productionOrderId={many ? commission.production_order_id : null}
                title={many ? title : null}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
