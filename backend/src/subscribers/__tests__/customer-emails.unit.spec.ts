import { captureCoveredByBalanceMail } from "../../lib/balance-settlement"

/**
 * Pravidlo, kterým `customer-emails.onPaymentCaptured` pozná, že zachycená
 * platba patří k doplatku zakázky a e-mail „Platba přijata" NEMÁ posílat —
 * zákazník už dostává „Doplatek přijat" z `made-to-order.balance-paid`.
 * (Samotný subscriber se tu neimportuje: tahá modul notifikací; pravidlo je
 * čistá funkce v lib/balance-settlement.)
 */

const now = Date.parse("2026-10-09T15:00:00Z")

describe("onPaymentCaptured — skip pro doplatek zakázky", () => {
  it('ruční „Zaplaceno na místě" (offline_method v metadatech kolekce) — e-mail mlčí', () => {
    expect(
      captureCoveredByBalanceMail(
        {
          payment_collection: {
            id: "paycol_balance",
            metadata: { offline_method: "card_on_site", made_to_order_balance: true },
          },
        },
        [],
        now
      )
    ).toBe(true)
  })

  it("doplatek z brány (zaplacená žádost na tutéž kolekci) — e-mail mlčí, jde balance-paid", () => {
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_balance", metadata: {} } },
        [
          {
            type: "balance",
            status: "paid",
            payment_collection_id: "paycol_balance",
            paid_at: "2026-10-01T10:00:00Z",
          },
        ],
        now
      )
    ).toBe(true)
  })

  it("záchrana: žádost označená zaplacenou v posledních 5 minutách", () => {
    const requests = [
      {
        type: "balance",
        status: "paid",
        payment_collection_id: null,
        paid_at: new Date(now - 3 * 60 * 1000).toISOString(),
      },
    ]
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_whatever", metadata: null } },
        requests,
        now
      )
    ).toBe(true)
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_whatever", metadata: null } },
        [{ ...requests[0], paid_at: new Date(now - 6 * 60 * 1000).toISOString() }],
        now
      )
    ).toBe(false)
  })

  it("běžná objednávka, dobírka, opakovaná karta — e-mail jde", () => {
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_card", metadata: null } },
        [],
        now
      )
    ).toBe(false)
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_card", metadata: null } },
        [{ type: "balance", status: "sent", payment_collection_id: "paycol_card", paid_at: null }],
        now
      )
    ).toBe(false)
  })
})
