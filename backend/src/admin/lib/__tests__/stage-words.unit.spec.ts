import { nextStepLabel, stageLabel } from "../stage-words"

describe("slova fází — zásilka vs. osobní odběr", () => {
  it("u zásilky zůstává odesílání", () => {
    expect(stageLabel("shipping")).toBe("K odeslání")
    expect(stageLabel("shipped")).toBe("Odesláno")
    expect(nextStepLabel("working")).toBe("Připraveno k odeslání")
    expect(nextStepLabel("shipping")).toBe("Označit jako odeslané")
  })

  it("u odběru se nikam nic neposílá", () => {
    expect(stageLabel("shipping", true)).toBe("Připraveno k vyzvednutí")
    expect(stageLabel("shipped", true)).toBe("Vyzvednuto")
    expect(nextStepLabel("working", true)).toBe("Připraveno k vyzvednutí")
    expect(nextStepLabel("shipping", true)).toBe("Vyzvednuto a zaplaceno")
  })

  it("fáze bez vlastního znění odběru zůstávají stejné", () => {
    for (const stage of ["received", "working", "payment_problem", "cancelled"]) {
      expect(stageLabel(stage, true)).toBe(stageLabel(stage))
    }
    expect(nextStepLabel("received", true)).toBe("Začít připravovat")
  })

  it("neznámou fázi vrátí, jak přišla — nikdy prázdno", () => {
    expect(stageLabel("vymysleno", true)).toBe("vymysleno")
    expect(stageLabel(null)).toBe("")
    expect(nextStepLabel("shipped")).toBeUndefined()
  })
})
