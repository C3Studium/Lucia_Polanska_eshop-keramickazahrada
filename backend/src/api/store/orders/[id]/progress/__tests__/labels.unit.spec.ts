import { customerStageLabel } from "../labels"
import { MERCHANT_ORDER_STAGES } from "../../../../../../modules/merchant-order/stages"

/**
 * The customer-facing wording of the merchant's stages.
 *
 * Worth pinning for two reasons. The first is coverage: `MERCHANT_ORDER_STAGES`
 * is the merchant's own list and will grow. A stage added there without a label
 * here would silently return `null`, and the customer's order page would go
 * blank at exactly the moment a new state was introduced — the one time anyone
 * is watching. The loop below fails instead.
 *
 * The second is the wording itself. These are deliberately not translations of
 * the internal names, and both exceptions are easy to "tidy" back into being
 * wrong: `shipping` means packed and waiting for the carrier, not in transit,
 * and `payment_problem` is stated as the customer's action rather than our
 * trouble.
 */
describe("customer-facing stage labels", () => {
  it("has a label for every merchant stage", () => {
    for (const stage of MERCHANT_ORDER_STAGES) {
      expect(customerStageLabel(stage)).toBeTruthy()
    }
  })

  it("does not say a packed order has been sent", () => {
    // „Odesíláme"/„Odesláno" here would produce a tracking question a day early.
    expect(customerStageLabel("shipping")).toBe("Chystáme k odeslání")
    expect(customerStageLabel("shipped")).toBe("Odesláno")
  })

  it("states a payment problem as what the customer can do about it", () => {
    expect(customerStageLabel("payment_problem")).toBe("Čeká na platbu")
  })

  it("names the wait the customer actually cares about", () => {
    expect(customerStageLabel("working")).toBe("Připravujeme")
  })

  it("returns null for no stage, rather than inventing one", () => {
    // Orders predating the merchant-order module have none; the storefront
    // falls back to Medusa's own status there.
    expect(customerStageLabel(null)).toBeNull()
    expect(customerStageLabel(undefined)).toBeNull()
    expect(customerStageLabel("neco_jineho")).toBeNull()
  })
})
