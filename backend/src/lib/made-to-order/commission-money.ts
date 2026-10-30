import { round2, toNumber } from "../claims/refund-rules"
import { productionOutstanding } from "../ship-gate"

/**
 * Peníze JEDNÉ zakázky = jedné položky objednávky (LEGAL_AUDIT.md § 0c, Z-A).
 * Čisté výpočty bez kontejneru, dokazované testem
 * (`lib/__tests__/made-to-order-commission-money.unit.spec.ts`).
 *
 * ## Proč zakázka „nese objednávku"
 *
 * Doprava, balné a běžné zboží patří OBJEDNÁVCE, ne žádné položce — ale někdo
 * ty peníze musí vybrat (doplatek) a nativní kolekce plateb na ně musí sedět.
 * Proto je PRVNÍ zakázka objednávky „nosič": její `original_total` =
 * `line_total` + (vše ostatní v objednávce) a její záloha v pokladně nese i
 * to, co se z toho ostatního zaplatilo hned (`order_extras_paid`). Součet
 * `original_total` všech zakázek objednávky = celá objednávka, součet jejich
 * záloh = pokladní platba — brána odeslání, kolekce doplatku i staré sumy
 * tak sedí beze změny.
 *
 * Pro zákazníka se ale počítá POLOŽKA: `item_total`, `deposit_paid` za
 * položku, `item_outstanding`. Tahle funkce obojí rozděluje na jednom místě,
 * ať PDF, store API a admin říkají stejná čísla.
 *
 * ## Legacy
 *
 * Zakázka z doby před 20. 10. 2026 (`line_item_id` null) = celá objednávka:
 * `line_total` chybí, položka = `original_total`, nic „navíc" — všechna čísla
 * vyjdou přesně jako dřív.
 */

export type CommissionMoneySource = {
  id?: string
  stage?: string | null
  line_item_id?: string | null
  line_total?: unknown
  original_total?: unknown
  agreed_total?: unknown
  surcharge?: unknown
  /** Poštovné a balné domluvené u ceny po domluvě (ne z pokladny). */
  shipping_total?: unknown
  packaging_total?: unknown
  order_extras_paid?: unknown
}

export type CommissionPaymentRequestLike = {
  type?: string | null
  status?: string | null
  amount?: unknown
}

export type CommissionMoney = {
  /** Cena samotné položky (dohodnutá ?? původní, bez dopravy/balného/ostatního zboží). */
  item_total: number
  /** Příplatek (modul zakázky) — navyšuje dluh položky. */
  surcharge: number
  /** Doprava, balné a běžné zboží, které tato zakázka nese za objednávku (0 u ostatních a u legacy). */
  extras_total: number
  /** Z toho zaplaceno v pokladně. */
  extras_paid: number
  /** Z toho ještě nezaplaceno (vybere se s doplatkem této zakázky). */
  extras_outstanding: number
  /** Zaplacená záloha celkem (žádosti `deposit`), včetně části za objednávku. */
  deposit_paid_raw: number
  /** Zaplacená záloha ZA POLOŽKU. */
  deposit_paid: number
  balance_paid: number
  /** Dluh zakázky celkem (`productionOutstanding`): položka + příplatek + nesené „navíc" − zaplaceno. */
  outstanding: number
  /** Dluh ZA POLOŽKU (bez neseného „navíc"). */
  item_outstanding: number
  /** Nese tato zakázka za objednávku dopravu/balné/ostatní zboží? */
  carries_order_extras: boolean
  /** Zakázka z doby před 20. 10. 2026 — celá objednávka. */
  legacy: boolean
}

export const isLegacyCommission = (
  productionOrder: Pick<CommissionMoneySource, "line_item_id"> | null | undefined
): boolean => productionOrder?.line_item_id === null || productionOrder?.line_item_id === undefined

const paidOf = (requests: CommissionPaymentRequestLike[] | null | undefined, type: "deposit" | "balance") =>
  round2(
    (requests ?? [])
      .filter((request) => request?.type === type && request?.status === "paid")
      .reduce((sum, request) => sum + toNumber(request.amount), 0)
  )

/**
 * „Navíc" zaplacené (nebo účtované) UŽ V POKLADNĚ: `original_total − line_total`
 * (0 u legacy). Je to součást `original_total`, proto se od ceny položky
 * odečítá.
 */
const checkoutExtrasTotal = (productionOrder: CommissionMoneySource): number => {
  if (isLegacyCommission(productionOrder)) return 0
  if (productionOrder.line_total === null || productionOrder.line_total === undefined) return 0
  return Math.max(0, round2(toNumber(productionOrder.original_total) - toNumber(productionOrder.line_total)))
}

/**
 * Poštovné a balné domluvené AŽ S CENOU (cena po domluvě, 30. 10. 2026).
 * Vlastní sloupce vedle ceny, takže se od ceny položky NEodečítají — jen se
 * k dluhu přičítají, stejně jako příplatek.
 */
export const agreedExtrasTotal = (productionOrder: CommissionMoneySource): number =>
  round2(toNumber(productionOrder.shipping_total) + toNumber(productionOrder.packaging_total))

/** Všechno „navíc", co zakázka nese za objednávku: z pokladny + domluvené. */
export const commissionExtrasTotal = (productionOrder: CommissionMoneySource): number =>
  round2(checkoutExtrasTotal(productionOrder) + agreedExtrasTotal(productionOrder))

/** Cena položky: (dohodnutá ?? původní) − „navíc" z pokladny. */
export const commissionItemTotal = (productionOrder: CommissionMoneySource): number => {
  const total = toNumber(productionOrder.agreed_total ?? productionOrder.original_total)
  return Math.max(0, round2(total - checkoutExtrasTotal(productionOrder)))
}

export const commissionMoney = (
  productionOrder: CommissionMoneySource,
  requests: CommissionPaymentRequestLike[] | null | undefined
): CommissionMoney => {
  const legacy = isLegacyCommission(productionOrder)
  const extrasTotal = commissionExtrasTotal(productionOrder)
  const extrasPaid = Math.min(
    extrasTotal,
    Math.max(0, round2(toNumber(productionOrder.order_extras_paid)))
  )
  const depositPaidRaw = paidOf(requests, "deposit")
  const balancePaid = paidOf(requests, "balance")
  const outstanding = round2(
    Math.max(
      0,
      productionOutstanding({
        ...productionOrder,
        payment_requests: (requests ?? []) as never,
      })
    )
  )
  // Nezaplacené „navíc" se vybírá s doplatkem této zakázky — z dluhu zakázky
  // tedy patří objednávce nejvýš to, co z „navíc" ještě chybí.
  const extrasOutstanding = Math.min(outstanding, Math.max(0, round2(extrasTotal - extrasPaid)))

  return {
    item_total: commissionItemTotal(productionOrder),
    surcharge: round2(toNumber(productionOrder.surcharge)),
    extras_total: extrasTotal,
    extras_paid: extrasPaid,
    extras_outstanding: extrasOutstanding,
    deposit_paid_raw: depositPaidRaw,
    deposit_paid: Math.max(0, round2(depositPaidRaw - extrasPaid)),
    balance_paid: balancePaid,
    outstanding,
    item_outstanding: round2(Math.max(0, outstanding - extrasOutstanding)),
    carries_order_extras: extrasTotal > 0,
    legacy,
  }
}

export type CommissionTotals = {
  deposit_paid: number
  balance_paid: number
  outstanding: number
  /** Z dluhu patří objednávce (doprava/balné ještě nezaplacené). */
  extras_outstanding: number
}

/** Součty za objednávku přes všechny její zakázky (zrušené nedluží nic — hlídá `productionOutstanding`). */
export const sumCommissionMoney = (money: CommissionMoney[]): CommissionTotals =>
  money.reduce<CommissionTotals>(
    (acc, item) => ({
      deposit_paid: round2(acc.deposit_paid + item.deposit_paid_raw),
      balance_paid: round2(acc.balance_paid + item.balance_paid),
      outstanding: round2(acc.outstanding + item.outstanding),
      extras_outstanding: round2(acc.extras_outstanding + item.extras_outstanding),
    }),
    { deposit_paid: 0, balance_paid: 0, outstanding: 0, extras_outstanding: 0 }
  )
