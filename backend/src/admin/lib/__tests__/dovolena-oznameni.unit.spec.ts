import {
  dovolenaVidet,
  odkazSedi,
  oznameniVidet,
  prazskyDnes,
  upravenyOdkaz,
} from "../dovolena-oznameni"

/**
 * Zapnuto ≠ vidět. Právě tenhle rozdíl se v administraci nepoznal: přepínač
 * svítil, uložení hlásilo úspěch a v obchodě nebylo nic.
 */
describe("dovolená", () => {
  it("zapnutá bez data visí pořád", () => {
    expect(dovolenaVidet({ enabled: true }, "2026-11-05")).toBe(true)
    expect(dovolenaVidet({ enabled: true, until: "" }, "2026-11-05")).toBe(true)
  })

  it("den před návratem ještě visí", () => {
    expect(
      dovolenaVidet({ enabled: true, until: "2026-11-06" }, "2026-11-05")
    ).toBe(true)
  })

  /* „Návrat 6. 11." znamená, že 6. 11. je zpátky — ten den už dovolená není. */
  it("dnem návratu končí", () => {
    expect(
      dovolenaVidet({ enabled: true, until: "2026-11-05" }, "2026-11-05")
    ).toBe(false)
  })

  it("datum v minulosti nevisí, i když je přepínač zapnutý", () => {
    expect(
      dovolenaVidet({ enabled: true, until: "2026-10-01" }, "2026-11-05")
    ).toBe(false)
  })

  it("vypnutá nevisí nikdy", () => {
    expect(
      dovolenaVidet({ enabled: false, until: "2026-12-24" }, "2026-11-05")
    ).toBe(false)
  })

  it("dnešek je v pražském pásmu a ve tvaru yyyy-mm-dd", () => {
    // Půlnoc UTC je v Praze už 5. 11. (zimní čas = UTC+1).
    expect(prazskyDnes(new Date("2026-11-05T00:30:00Z"))).toBe("2026-11-05")
    // A 23:30 UTC je v Praze už další den.
    expect(prazskyDnes(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06")
  })
})

describe("oznámení", () => {
  it("bez textu se neukáže, i když je zapnuté", () => {
    expect(oznameniVidet({ enabled: true, text: "   " })).toBe(false)
    expect(oznameniVidet({ enabled: true })).toBe(false)
  })

  it("s textem a zapnuté se ukáže", () => {
    expect(oznameniVidet({ enabled: true, text: "Jsem na trhu" })).toBe(true)
  })

  it("vypnuté se neukáže, i když text zůstal", () => {
    expect(oznameniVidet({ enabled: false, text: "Jsem na trhu" })).toBe(false)
  })
})

describe("odkaz u oznámení", () => {
  it("doplní protokol, když chybí", () => {
    expect(upravenyOdkaz("naplavka.cz")).toBe("https://naplavka.cz")
    expect(upravenyOdkaz("  www.naplavka.cz/trh  ")).toBe(
      "https://www.naplavka.cz/trh"
    )
  })

  it("hotovou adresu nechá být", () => {
    expect(upravenyOdkaz("http://naplavka.cz")).toBe("http://naplavka.cz")
    expect(upravenyOdkaz("HTTPS://Naplavka.cz")).toBe("HTTPS://Naplavka.cz")
  })

  it("prázdno zůstane prázdné — pole je nepovinné", () => {
    expect(upravenyOdkaz("   ")).toBe("")
    expect(odkazSedi("")).toBe(true)
  })

  it("pozná, co adresa není", () => {
    expect(odkazSedi("naplavka")).toBe(false)
    expect(odkazSedi("to je trh u vody")).toBe(false)
  })

  it("obyčejný zápis bez protokolu projde", () => {
    expect(odkazSedi("naplavka.cz")).toBe(true)
  })
})
