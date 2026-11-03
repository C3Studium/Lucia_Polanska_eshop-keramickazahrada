import { isBalanceRequest, isDepositRequest } from "../payment-kind"
import { splitCommissionPayments } from "../../commission-breakdown"

/**
 * Záloha u ceny po domluvě se ukládá s typem „balance" (jinak by ji dohled
 * ani vypořádání nezapsaly). Když se podle toho nerozlišovalo, zůstala
 * zakázka BEZ FAKTURY — zaplacená záloha nepadla ani mezi zálohy, ani mezi
 * doplatky, protože ty se fakturují až po doplacení celé zakázky.
 */
describe("záloha, nebo doplatek", () => {
  it("řádek z pokladny je záloha podle typu", () => {
    expect(isDepositRequest({ type: "deposit", idempotency_key: null })).toBe(true)
    expect(isBalanceRequest({ type: "deposit" })).toBe(false)
  })

  it("záloha u ceny po domluvě se pozná podle klíče, ne podle typu", () => {
    const zaloha = { type: "balance", idempotency_key: "deposit:po_1:1500" }
    expect(isDepositRequest(zaloha)).toBe(true)
    expect(isBalanceRequest(zaloha)).toBe(false)
  })

  it("skutečný doplatek zůstává doplatkem", () => {
    const doplatek = { type: "balance", idempotency_key: "balance:po_1:3700" }
    expect(isDepositRequest(doplatek)).toBe(false)
    expect(isBalanceRequest(doplatek)).toBe(true)
  })

  it("chybějící řádek ani klíč nic neshodí", () => {
    expect(isDepositRequest(null)).toBe(false)
    expect(isDepositRequest(undefined)).toBe(false)
    expect(isDepositRequest({})).toBe(false)
    expect(isDepositRequest({ type: "balance" })).toBe(false)
  })
})

describe("rozpis plateb u ceny po domluvě", () => {
  it("zaplacená záloha se počítá jako záloha, ne jako doplatek", () => {
    const rozpis = splitCommissionPayments({
      requests: [
        { type: "balance", idempotency_key: "deposit:po_1:1500", status: "paid", amount: 1500 },
      ],
      surcharge: 0,
    })

    expect(rozpis.deposit).toBe(1500)
    expect(rozpis.balance).toBe(0)
    expect(rozpis.totalPaid).toBe(1500)
  })

  it("záloha i doplatek vedle sebe sedí (5 200 = 1 500 + 3 700)", () => {
    const rozpis = splitCommissionPayments({
      requests: [
        { type: "balance", idempotency_key: "deposit:po_1:1500", status: "paid", amount: 1500 },
        { type: "balance", idempotency_key: "balance:po_1:3700", status: "paid", amount: 3700 },
        { type: "balance", idempotency_key: "balance:po_1:99", status: "pending", amount: 99 },
      ],
      surcharge: 200,
    })

    expect(rozpis.deposit).toBe(1500)
    expect(rozpis.surcharge).toBe(200)
    expect(rozpis.balance).toBe(3500)
    expect(rozpis.totalPaid).toBe(5200)
  })
})
