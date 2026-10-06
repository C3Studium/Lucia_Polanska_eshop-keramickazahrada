import { convertToLocale } from "@lib/util/money"
import type { CommissionBalance } from "@lib/data/made-to-order"

import s from "./style.module.scss"

/**
 * „Doplatit" — panel s doplatkem zakázky a tlačítkem na zaplacení zbytku.
 *
 * Jeden znovupoužitelný prvek pro všechny stránky objednávky (potvrzení, úprava,
 * reklamace, detail v účtu): když zakázce něco zbývá doplatit, ukáže kolik je
 * zaplaceno zálohou, kolik zbývá, a tlačítko, které vede na doplacení (pay-balance
 * → ComGate; po návratu se doplatek dorovná). Prezentační — data si bere stránka
 * přes `getCommissionBalance`, ať jde použít v serverovém i klientském stromu.
 * Když není co doplácet / není to zakázka, nevykreslí nic.
 */
export default function BalancePayPanel({
  balance,
  className,
}: {
  balance: CommissionBalance | null
  className?: string
}) {
  const outstanding = balance?.outstanding ?? 0
  if (!balance?.is_commission || !balance.pay_url || outstanding <= 0.005) {
    return null
  }

  const money = (amount: number) =>
    convertToLocale({
      amount,
      currency_code: balance.currency_code ?? "czk",
    })

  return (
    <section
      className={className ? `${s.root} ${className}` : s.root}
      aria-label="Doplatek zakázky"
    >
      <p className={s.eyebrow}>Zakázková výroba</p>
      <div className={s.rows}>
        {balance.deposit_paid ? (
          <div className={s.row}>
            <span>Zaplaceno zálohou</span>
            <strong>{money(balance.deposit_paid)}</strong>
          </div>
        ) : null}
        <div className={s.row}>
          <span>Zbývá doplatit</span>
          <strong className={s.outstanding}>{money(outstanding)}</strong>
        </div>
      </div>
      <a className={s.payBtn} href={balance.pay_url}>
        Doplatit {money(outstanding)}
      </a>
    </section>
  )
}
