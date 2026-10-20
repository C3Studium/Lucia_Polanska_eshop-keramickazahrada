import { readFileSync } from "fs"
import { resolve } from "path"
import {
  LEGAL_FACT_DEFAULTS,
  LEGAL_FACT_GROUPS,
  LEGAL_FACT_KEYS,
  LEGAL_FACT_META,
  isLegalFactKey,
  legalFactProblem,
  missingLegalFacts,
  pickStoredLegalFacts,
  resolveLegalFacts,
  sameLegalFacts,
} from "../legal-facts"

/**
 * Právní údaje (administrace → Právní údaje). Výchozí hodnoty backendu jsou
 * kopie `FACTS` storefrontu — web je bere jako zálohu, když backend
 * neodpovídá. Kdyby se kopie rozjely, web by při výpadku tvrdil něco jiného
 * než e-maily; proto se tu storefrontový soubor čte jako text.
 */

const STOREFRONT_FACTS = resolve(__dirname, "../../../../storefront/src/lib/legal/facts.ts")

/** `FACTS` ze storefrontu: klíče v pořadí a hodnoty (`null` / text). */
const readStorefrontFacts = (): Array<[string, string | null]> => {
  const source = readFileSync(STOREFRONT_FACTS, "utf8")
  const start = source.indexOf("export const FACTS = {")
  const end = source.indexOf("} as const", start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  const body = source
    .slice(start, end)
    // Komentáře pryč — v JSDocu nad údaji jsou čísla účtů a uvozovky.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
  const entries: Array<[string, string | null]> = []
  const entry = /"([A-Za-z0-9.]+)":\s*(null|"((?:[^"\\]|\\.)*)")/g
  let match: RegExpExecArray | null
  while ((match = entry.exec(body)) !== null) {
    entries.push([match[1], match[2] === "null" ? null : JSON.parse(match[2])])
  }
  return entries
}

describe("legal facts — backend copy of storefront FACTS", () => {
  const storefront = readStorefrontFacts()

  it("has exactly the storefront keys, in the same order", () => {
    expect(storefront.length).toBeGreaterThan(10)
    expect([...LEGAL_FACT_KEYS]).toEqual(storefront.map(([key]) => key))
  })

  it("has the same default values (filled ones identical, the rest null)", () => {
    expect(Object.entries(LEGAL_FACT_DEFAULTS)).toEqual(storefront)
    // Identita a dodací lhůta jsou vyplněné, zbytek čeká na Lucii.
    expect(LEGAL_FACT_DEFAULTS["seller.ico"]).toBe("03441482")
    expect(LEGAL_FACT_DEFAULTS["bank.account"]).toBeNull()
  })
})

describe("legal fact metadata (form)", () => {
  it("describes every key, in a known group, with a sane limit", () => {
    expect(Object.keys(LEGAL_FACT_META).sort()).toEqual([...LEGAL_FACT_KEYS].sort())
    for (const key of LEGAL_FACT_KEYS) {
      const meta = LEGAL_FACT_META[key]
      expect(LEGAL_FACT_GROUPS).toContain(meta.group)
      expect(meta.label.trim()).not.toBe("")
      expect(meta.help.length).toBeGreaterThan(40)
      expect(meta.maxLength).toBeGreaterThan(0)
      expect(meta.maxLength).toBeLessThanOrEqual(2000)
    }
    expect(LEGAL_FACT_META["course.cancellation"].maxLength).toBe(2000)
    expect(LEGAL_FACT_META["course.cancellation"].multiline).toBe(true)
  })

  it("every group has at least one field", () => {
    for (const group of LEGAL_FACT_GROUPS) {
      expect(LEGAL_FACT_KEYS.some((key) => LEGAL_FACT_META[key].group === group)).toBe(true)
    }
  })

  it("its own examples and defaults pass the write validation", () => {
    for (const key of LEGAL_FACT_KEYS) {
      expect(legalFactProblem(key, LEGAL_FACT_META[key].example)).toBeNull()
      const fallback = LEGAL_FACT_DEFAULTS[key]
      if (fallback !== null) expect(legalFactProblem(key, fallback)).toBeNull()
    }
  })

  it("knows its keys", () => {
    expect(isLegalFactKey("seller.email")).toBe(true)
    expect(isLegalFactKey("seller.iban")).toBe(false)
    expect(isLegalFactKey("toString")).toBe(false)
  })
})

describe("resolveLegalFacts", () => {
  it("falls back to the defaults for anything not stored", () => {
    expect(resolveLegalFacts(undefined)).toEqual(LEGAL_FACT_DEFAULTS)
    expect(resolveLegalFacts(null)).toEqual(LEGAL_FACT_DEFAULTS)
    expect(resolveLegalFacts({})).toEqual(LEGAL_FACT_DEFAULTS)
    expect(resolveLegalFacts("nesmysl")).toEqual(LEGAL_FACT_DEFAULTS)
    expect(resolveLegalFacts(["seller.name"])).toEqual(LEGAL_FACT_DEFAULTS)
  })

  it("uses stored text (trimmed), empty = explicitly not filled", () => {
    const facts = resolveLegalFacts({
      "mto.deposit": "  40 %  ",
      "seller.phone": "",
      "seller.web": "   ",
      "vat.status": null,
    })
    expect(facts["mto.deposit"]).toBe("40 %")
    // Vymazaný údaj nespadne zpátky na výchozí — majitelka ho chce prázdný.
    expect(facts["seller.phone"]).toBeNull()
    expect(facts["seller.web"]).toBeNull()
    expect(facts["vat.status"]).toBeNull()
    expect(facts["seller.name"]).toBe(LEGAL_FACT_DEFAULTS["seller.name"])
  })

  it("ignores unknown keys and corrupted values", () => {
    const facts = resolveLegalFacts({
      "seller.iban": "CZ00",
      "bank.account": 2500675505,
      "seller.name": { name: "x" },
    })
    expect(facts).not.toHaveProperty("seller.iban")
    expect(facts["bank.account"]).toBeNull()
    expect(facts["seller.name"]).toBe(LEGAL_FACT_DEFAULTS["seller.name"])
  })

  it("does not hand out the shared defaults object", () => {
    const facts = resolveLegalFacts(undefined)
    facts["seller.name"] = "jiná"
    expect(resolveLegalFacts(undefined)["seller.name"]).toBe("Lucie Polanská")
  })
})

describe("helpers", () => {
  it("lists missing facts in form order", () => {
    const missing = missingLegalFacts(resolveLegalFacts({ "seller.phone": "" }))
    expect(missing[0]).toBe("seller.phone")
    expect(missing).toContain("bank.account")
    expect(missing).not.toContain("seller.name")
    expect(missing).not.toContain("delivery.dispatchTime")
    // Zakázky (záloha) jsou ve formuláři před kurzy.
    expect(missing.indexOf("mto.deposit")).toBeLessThan(missing.indexOf("course.cancellation"))
  })

  it("compares effective values, not the stored shape", () => {
    expect(sameLegalFacts({}, { "seller.name": "Lucie Polanská" })).toBe(true)
    expect(sameLegalFacts({ "mto.deposit": "40 %" }, { "mto.deposit": " 40 % " })).toBe(true)
    expect(sameLegalFacts({}, { "seller.phone": "" })).toBe(false)
    expect(sameLegalFacts({ "mto.deposit": "40 %" }, { "mto.deposit": "50 %" })).toBe(false)
  })

  it("keeps only known text entries from a stored object", () => {
    expect(
      pickStoredLegalFacts({ "mto.deposit": "40 %", "seller.phone": "", junk: "x", "vat.status": 1 })
    ).toEqual({ "mto.deposit": "40 %", "seller.phone": "" })
    expect(pickStoredLegalFacts(null)).toEqual({})
  })

  it("explains in Czech why a value cannot be saved", () => {
    expect(legalFactProblem("seller.email", "")).toBeNull()
    expect(legalFactProblem("seller.email", "info@keramickazahrada.cz")).toBeNull()
    expect(legalFactProblem("seller.email", "info keramickazahrada.cz")).toMatch(/e-mailová adresa/)
    expect(legalFactProblem("seller.webUrl", "keramickazahrada.cz")).toMatch(/https:\/\//)
    expect(legalFactProblem("mto.deposit", "x".repeat(61))).toMatch(/nejvýš 60 znaků/)
    expect(legalFactProblem("course.cancellation", "x".repeat(2000))).toBeNull()
  })
})
