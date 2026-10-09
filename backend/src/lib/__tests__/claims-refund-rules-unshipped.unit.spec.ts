import { canRefund } from "../claims/refund-rules"
import { goodsShipped } from "../claims/money"

/**
 * Odstoupení / vrácení PŘED odesláním (#37, 9. 10. 2026): zboží nikdy
 * neodešlo, takže § 1832/4 nemá na co čekat — peníze jdou rovnou ze stavu
 * „schváleno", bez vědomého `skip_goods_check`.
 */
describe("refundace u zboží, které neodešlo", () => {
  it("odstoupení ve stavu approved: bez odeslání jde vracet rovnou", () => {
    expect(canRefund({ kind: "odstoupeni", status: "approved", goods_shipped: false }).allowed).toBe(true)
    expect(canRefund({ kind: "vraceni", status: "approved", goods_shipped: false }).allowed).toBe(true)
  })

  it("odstoupení ve stavu approved: po odeslání se dál čeká na zboží", () => {
    const verdict = canRefund({ kind: "odstoupeni", status: "approved", goods_shipped: true })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toMatch(/Zboží se ještě nevrátilo/)
    // Bez informace (starý volající) = jako dřív: čeká se.
    expect(canRefund({ kind: "odstoupeni", status: "approved" }).allowed).toBe(false)
  })

  it("reklamace se vlajkou neřídí — oprava v approved peníze nevrací", () => {
    expect(
      canRefund({ kind: "reklamace", status: "approved", resolution: "repair", goods_shipped: false }).allowed
    ).toBe(false)
  })

  it("goodsShipped: jen nezrušený fulfillment s datem odeslání", () => {
    expect(goodsShipped({ fulfillments: [] })).toBe(false)
    expect(goodsShipped({ fulfillments: [{ shipped_at: null, canceled_at: null }] })).toBe(false)
    expect(goodsShipped({ fulfillments: [{ shipped_at: "2026-10-09T10:00:00Z", canceled_at: "2026-10-09T11:00:00Z" }] })).toBe(false)
    expect(goodsShipped({ fulfillments: [{ shipped_at: "2026-10-09T10:00:00Z", canceled_at: null }] })).toBe(true)
  })
})
