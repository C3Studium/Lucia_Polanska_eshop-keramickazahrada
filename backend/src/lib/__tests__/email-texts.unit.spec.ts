import {
  EMAIL_CATEGORIES,
  emailTextCatalog,
  isEditableEmail,
  isPreviewableEmail,
  renderEmailPreview,
} from "../email-texts"

/**
 * Administrace → Emaily, záložky Zákazník / Admin a filtr podle akce
 * (21. 11. 2026). Hlídá, aby nový e-mail nespadl bez skupiny do „Ostatní"
 * a aby ukázky „Nové objednávky" šly jen prohlédnout.
 */
describe("Emaily v administraci", () => {
  const catalog = emailTextCatalog({})
  const categoryAudience = new Map(EMAIL_CATEGORIES.map((item) => [item.key, item.audience]))

  it("každý e-mail má skupinu ze seznamu a ta patří k jeho záložce", () => {
    for (const email of catalog) {
      expect(categoryAudience.has(email.category)).toBe(true)
      expect(categoryAudience.get(email.category)).toBe(email.audience)
    }
  })

  it("žádný zákaznický e-mail nezůstane bez akce v „Ostatní“", () => {
    expect(catalog.filter((email) => email.category === "ostatni").map((email) => email.template)).toEqual([])
  })

  it("Admin ukazuje Novou objednávku podle platby i souhrny", () => {
    const owner = catalog.filter((email) => email.audience === "owner").map((email) => email.title)
    expect(owner).toEqual(
      expect.arrayContaining([
        "Nová zaplacená objednávka",
        "Nová objednávka — platba při převzetí (dobírka)",
        "Nová objednávka — platba při převzetí (osobní odběr)",
        "Nová zakázka — zaplacená celá",
        "Nová zakázka — zaplacená záloha",
        "Nová zakázka — cena po domluvě",
        "Nová zakázka — přečtěte si zadání",
        "Ostatní upozornění",
      ])
    )
    expect(catalog.filter((email) => email.category === "admin-souhrny")).toHaveLength(2)
  })

  it("ukázky jdou jen prohlédnout, ne uložit", () => {
    const variants = catalog.filter((email) => email.id.includes("#"))
    expect(variants.length).toBeGreaterThan(0)
    for (const variant of variants) {
      expect(variant.readOnly).toBe(true)
      expect(isPreviewableEmail(variant.id)).toBe(true)
      expect(isEditableEmail(variant.id)).toBe(false)
    }
  })

  it("souhrnům a upozorněním se předmět nepřepisuje (skládá ho odesílatel)", () => {
    for (const template of ["merchant-notification", "merchant-daily-summary", "merchant-weekly-summary"]) {
      expect(catalog.find((email) => email.id === template)?.editableSubject).toBe(false)
    }
  })

  it("náhled podoby vykreslí její předmět a vzorovou objednávku", async () => {
    const { html, subject } = await renderEmailPreview("merchant-notification#dobirka", {}, null)
    expect(subject).toBe("Nová objednávka #1043 — platba při převzetí")
    expect(html).toContain("Dobírka")
    expect(html).toContain("#1043")
  })
})
