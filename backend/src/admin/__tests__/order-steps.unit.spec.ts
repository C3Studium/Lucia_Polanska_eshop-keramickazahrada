import { buildOrderSteps } from "../lib/order-steps"

const shape = (steps: ReturnType<typeof buildOrderSteps>) =>
  steps.map((step) => `${step.key}:${step.state}`)

describe("postup objednávky", () => {
  it("běžné zboží: přijata → připravujeme → zabaleno → odesláno", () => {
    expect(shape(buildOrderSteps({ stage: "received", pickup: false, commissions: [] }))).toEqual([
      "received:done",
      "working:current",
      "packed:todo",
      "done:todo",
    ])
    expect(shape(buildOrderSteps({ stage: "shipping", pickup: false, commissions: [] }))).toEqual([
      "received:done",
      "working:done",
      "packed:done",
      "done:current",
    ])
  })

  it("osobní odběr bez „připravujeme“", () => {
    expect(shape(buildOrderSteps({ stage: "received", pickup: true, commissions: [] }))).toEqual([
      "received:done",
      "packed:current",
      "done:todo",
    ])
  })

  it("zakázka (i smíšená): bez „připravujeme“, výroba, doplatek, pak balení", () => {
    const steps = buildOrderSteps({
      stage: "working",
      pickup: false,
      commissions: [{ stage: "in_production", outstanding: 3000 }],
    })
    expect(shape(steps)).toEqual([
      "received:done",
      "confirm:done",
      "production:done",
      "complete:current",
      "balance:todo",
      "packed:todo",
      "done:todo",
    ])
  })

  it("hotová a zaplacená zakázka čeká na zabalení", () => {
    const steps = buildOrderSteps({
      stage: "working",
      pickup: false,
      commissions: [{ stage: "ready_to_ship", outstanding: 0 }],
    })
    expect(steps.find((step) => step.state === "current")?.key).toBe("packed")
  })

  it("víc zakázek = jeden krok výroby; zrušená postup nedrží", () => {
    const steps = buildOrderSteps({
      stage: "received",
      pickup: false,
      commissions: [
        { stage: "awaiting_balance", outstanding: 500 },
        { stage: "cancelled", outstanding: 900 },
        { stage: "confirmed", outstanding: 900 },
      ],
    })
    expect(shape(steps)).toEqual([
      "received:done",
      "production_multi:current",
      "balance:todo",
      "packed:todo",
      "done:todo",
    ])
  })

  it("zrušená objednávka nemá aktuální krok", () => {
    const steps = buildOrderSteps({ stage: "cancelled", pickup: false, commissions: [] })
    expect(steps.some((step) => step.state === "current")).toBe(false)
  })
})
