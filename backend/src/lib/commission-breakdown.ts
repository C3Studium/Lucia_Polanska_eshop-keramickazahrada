/**
 * Rozpis plateb zakázky: záloha · doplatek · příplatek · celkem zaplaceno.
 *
 * Jedno místo pro e-mail „Doplatek přijat", e-mail s fakturou i doplatkovou
 * fakturu (14. 10. 2026 — zákazník viděl jen „Částka 3 775 Kč" a nevěděl,
 * že v ní je příplatek a že zálohu už zaplatil).
 *
 * Příplatek je celý v doplatku (záloha se počítá z původní ceny), takže se
 * z doplatku jen vyčlení — stejně jako na faktuře (`issuePhase`).
 */

const round2 = (value: number) => Math.round(value * 100) / 100

const amountOf = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>
    return Number(v.value ?? v.numeric_ ?? 0) || 0
  }
  return 0
}

export type CommissionPayments = {
  /** Zaplacené zálohy. */
  deposit: number
  /** Zaplacený doplatek BEZ příplatku. */
  balance: number
  /** Příplatek (vyčleněný ze zaplaceného doplatku). */
  surcharge: number
  /** Všechno zaplacené dohromady. */
  totalPaid: number
}

export const splitCommissionPayments = (input: {
  requests: Array<{ type?: string | null; status?: string | null; amount?: unknown }>
  surcharge?: unknown
}): CommissionPayments => {
  const paid = input.requests.filter((request) => request?.status === "paid")
  const deposit = round2(
    paid.filter((r) => r.type === "deposit").reduce((sum, r) => sum + amountOf(r.amount), 0)
  )
  const balanceTotal = round2(
    paid.filter((r) => r.type === "balance").reduce((sum, r) => sum + amountOf(r.amount), 0)
  )
  const surcharge = round2(Math.min(Math.max(0, amountOf(input.surcharge)), balanceTotal))
  return {
    deposit,
    balance: round2(balanceTotal - surcharge),
    surcharge,
    totalPaid: round2(deposit + balanceTotal),
  }
}

/** Naformátovaný rozpis pro e-maily (prázdné položky → null, ať se řádek nevykreslí). */
export type CommissionPaymentsText = {
  deposit: string | null
  depositInvoiceNumber: string | null
  balance: string | null
  surcharge: string | null
  totalPaid: string
}

export const commissionPaymentsText = (
  payments: CommissionPayments,
  format: (amount: number) => string,
  depositInvoiceNumber?: string | null
): CommissionPaymentsText => ({
  deposit: payments.deposit > 0.005 ? format(payments.deposit) : null,
  depositInvoiceNumber: depositInvoiceNumber || null,
  balance: payments.balance > 0.005 ? format(payments.balance) : null,
  surcharge: payments.surcharge > 0.005 ? format(payments.surcharge) : null,
  totalPaid: format(payments.totalPaid),
})
