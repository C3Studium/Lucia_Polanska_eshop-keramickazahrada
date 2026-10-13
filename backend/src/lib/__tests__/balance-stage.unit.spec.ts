import { stageAfterBalancePaid } from "../balance-payment"

describe("stageAfterBalancePaid", () => {
  it("moves a finished piece waiting for the money to ready_to_ship", () => {
    expect(stageAfterBalancePaid("awaiting_balance")).toBe("ready_to_ship")
  })

  it.each(["specification_pending", "confirmed", "in_production"])(
    "leaves a piece that is not made yet (%s) where it is",
    (stage) => {
      expect(stageAfterBalancePaid(stage)).toBeNull()
    }
  )

  it.each(["ready_to_ship", "completed", "cancelled", null, undefined])(
    "never touches %s",
    (stage) => {
      expect(stageAfterBalancePaid(stage as any)).toBeNull()
    }
  )
})
