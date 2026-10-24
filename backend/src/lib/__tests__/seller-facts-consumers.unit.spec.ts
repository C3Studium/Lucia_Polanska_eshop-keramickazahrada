import { sellerContactEmail } from "../commission-inquiry"
import { LEGAL_FACT_DEFAULTS } from "../legal-facts"
import { protocolSeller } from "../reklamacni-protokol"

/**
 * Místa v backendu, kde stál prodávající natvrdo a teď ho říkají právní
 * údaje z administrace: reklamační protokol (PDF) a odpověď na potvrzení
 * poptávky. Oba potřebují údaj vždy — nevyplněný spadne na zálohu.
 */

describe("protocolSeller (reklamační protokol)", () => {
  it("prints the seller from the legal facts — person and IČO as in the terms", () => {
    expect(protocolSeller(LEGAL_FACT_DEFAULTS)).toEqual({
      name: "Lucie Polanská",
      address: "Putim 229, 397 01 Písek",
      ico: "03441482",
      email: "lucie.polanska@gmail.com",
      phone: "+420 775 211 578",
    })
    expect(protocolSeller({ ...LEGAL_FACT_DEFAULTS, "seller.phone": "+420 600 000 000" }).phone).toBe(
      "+420 600 000 000"
    )
  })

  it("falls back per field — a document never misses the seller's address", () => {
    const seller = protocolSeller({ ...LEGAL_FACT_DEFAULTS, "seller.address": null })
    expect(seller.address).toBe("Putim 229, 397 01 Písek")
    expect(protocolSeller(null).email).toBe("info@keramickazahrada.cz")
  })
})

describe("sellerContactEmail (poptávka zakázky)", () => {
  const env = process.env
  beforeEach(() => {
    process.env = { ...env }
    delete process.env.SELLER_EMAIL
  })
  afterAll(() => {
    process.env = env
  })

  it("replies go to the contact e-mail from the legal facts", () => {
    expect(sellerContactEmail(" dilna@keramickazahrada.cz ")).toBe("dilna@keramickazahrada.cz")
  })

  it("without it, the old fallback (env, then the address from the terms)", () => {
    expect(sellerContactEmail(null)).toBe("info@keramickazahrada.cz")
    process.env.SELLER_EMAIL = "atelier@example.cz"
    expect(sellerContactEmail(undefined)).toBe("atelier@example.cz")
  })
})
