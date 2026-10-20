import { convertToLocale } from "@lib/util/money"
import {
  commissionsOf,
  commissionTitle,
  type Commission,
  type CommissionBalance,
} from "@lib/util/made-to-order"

import s from "./style.module.scss"

type Props = {
  /**
   * Celý stav z `/balance` — panel vykreslí doplatek KAŽDÉ zakázky, která
   * něco dluží (Z-A „zakázka = položka"). Pro stránky, které nerozkládají
   * zakázky samy (úprava objednávky).
   */
  balance?: CommissionBalance | null
  /** Jedna zakázka — pro seznam zakázek, kde panel stojí pod jejím panelem. */
  commission?: Commission | null
  className?: string
  /** `full` = s rozpisem (zaplaceno zálohou / zbývá); `button` = jen tlačítko
   *  (tam, kde rozpis nese už něco jiného, třeba Souhrn na potvrzení). */
  variant?: "full" | "button"
  /** Ukázat název zakázky nad rozpisem (u víc zakázek v objednávce). */
  showTitle?: boolean
}

/**
 * „Doplatit" — panel s doplatkem zakázky a tlačítkem na zaplacení zbytku.
 *
 * Jeden znovupoužitelný prvek pro všechny stránky objednávky (potvrzení, úprava,
 * reklamace, detail v účtu): když zakázce něco zbývá doplatit, ukáže kolik je
 * zaplaceno zálohou, kolik zbývá, a tlačítko, které vede na doplacení (pay-balance
 * → ComGate; po návratu se doplatek dorovná). Prezentační — data si bere stránka
 * přes `getCommissionBalance`, ať jde použít v serverovém i klientském stromu.
 *
 * Doplatek je PER ZAKÁZKA (`pay_url` každé zakázky zvlášť) — u objednávky s
 * víc zakázkami je tolik panelů, kolik zakázek něco dluží. Když není co
 * doplácet / není to zakázka, nevykreslí nic.
 */
export default function BalancePayPanel({
  balance = null,
  commission = null,
  className,
  variant = "full",
  showTitle = false,
}: Props) {
  if (commission) {
    return (
      <SingleBalancePay
        commission={commission}
        className={className}
        variant={variant}
        showTitle={showTitle}
      />
    )
  }

  const commissions = commissionsOf(balance)
  const owing = commissions.filter(
    (item) => item.pay_url && (item.outstanding ?? 0) > 0.005
  )
  if (!owing.length) return null

  return (
    <>
      {owing.map((item, index) => (
        <SingleBalancePay
          key={item.production_order_id ?? item.line_item_id ?? index}
          commission={item}
          className={className}
          variant={variant}
          showTitle={showTitle || commissions.length > 1}
        />
      ))}
    </>
  )
}

function SingleBalancePay({
  commission,
  className,
  variant,
  showTitle,
}: {
  commission: Commission
  className?: string
  variant: "full" | "button"
  showTitle: boolean
}) {
  const outstanding = commission.outstanding ?? 0
  if (!commission.pay_url || outstanding <= 0.005) {
    return null
  }

  const money = (amount: number) =>
    convertToLocale({
      amount,
      currency_code: commission.currency_code ?? "czk",
    })
  const title = showTitle ? commissionTitle(commission) : null

  return (
    <section
      className={className ? `${s.root} ${className}` : s.root}
      aria-label={title ? `Doplatek zakázky ${title}` : "Doplatek zakázky"}
      data-testid="balance-pay-panel"
      data-production-order-id={commission.production_order_id ?? undefined}
    >
      <p className={s.eyebrow}>Zakázková výroba</p>
      {title && <p className={s.title}>{title}</p>}
      {variant === "full" && (
        <div className={s.rows}>
          {commission.deposit_paid ? (
            <div className={s.row}>
              <span>Zaplaceno zálohou</span>
              <strong>{money(commission.deposit_paid)}</strong>
            </div>
          ) : null}
          <div className={s.row}>
            <span>Zbývá doplatit</span>
            <strong className={s.outstanding}>{money(outstanding)}</strong>
          </div>
        </div>
      )}
      <a className={s.payBtn} href={commission.pay_url}>
        Doplatit {money(outstanding)}
      </a>
    </section>
  )
}
