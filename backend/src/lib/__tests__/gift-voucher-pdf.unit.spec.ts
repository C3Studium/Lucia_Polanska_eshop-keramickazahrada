import fs from "fs"
import path from "path"
import {
  dilnaGenitive,
  generateGiftVoucherPdf,
  giftVoucherPdfFilename,
} from "../gift-voucher-pdf"

/**
 * PDF poukazu (30. 10. 2026).
 *
 * Vykreslení se testovat nedá — co se dá, je že dokument vůbec vznikne,
 * nese diakritiku (Sansation, ne výchozí Helvetica, která by na „ě“ spadla)
 * a že je při stejném zadání bajt po bajtu stejný. Na té stálosti stojí
 * ukládání: klíč v R2 nese otisk obsahu, takže kolísající kresba by při
 * každém vystavení založila v úložišti další kopii téhož poukazu.
 *
 * `POUKAZ_PDF_OUT=cesta.pdf pnpm test:unit gift-voucher-pdf` vypíše ukázku
 * k prohlédnutí.
 */

const vzor = {
  voucherId: "gv_01TEST",
  code: "KZ-7HQ4-M2XP",
  value: "1 500 Kč",
  validUntil: "30. 10. 2027",
  recipientName: "Babička Marie",
  buyerName: "Jana Nováková",
  dedication: "Babičce k narozeninám — ať Ti keramika dělá radost.",
  voucherUrl: "https://store.matejforejt.com/cz/poukaz/gv_01TEST?token=abc",
  sellerName: "Lucie Polanská",
  sellerAddress: "Putim 229, 397 01 Písek",
  sellerPhone: "+420 775 211 578",
  sellerEmail: "lucie.polanska@gmail.com",
  sellerWeb: "keramickazahrada.cz",
  remainderNote: "zbytek hodnoty zůstává na poukazu",
}

describe("PDF dárkového poukazu", () => {
  it("vznikne jako PDF a dá se uložit k prohlédnutí", async () => {
    const bytes = await generateGiftVoucherPdf(vzor)
    expect(bytes.length).toBeGreaterThan(2000)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-")

    const out = process.env.POUKAZ_PDF_OUT
    if (out) {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, Buffer.from(bytes))
    }
  })

  /* Otisk obsahu je klíč souboru v R2 — kolísání = nová kopie při každém vystavení. */
  it("je při stejném zadání pokaždé stejné", async () => {
    const a = await generateGiftVoucherPdf(vzor)
    const b = await generateGiftVoucherPdf(vzor)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it("změna údajů se v souboru projeví", async () => {
    const a = await generateGiftVoucherPdf(vzor)
    const b = await generateGiftVoucherPdf({ ...vzor, value: "2 000 Kč" })
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  /* Bez obdarovaného a věnování (poukaz koupený pro sebe) nesmí spadnout. */
  it("projde i bez obdarovaného, věnování a odkazu", async () => {
    const bytes = await generateGiftVoucherPdf({
      voucherId: "gv_02",
      code: "KZ-ABCD-EFGH",
      value: "500 Kč",
      validUntil: "1. 1. 2028",
      sellerName: "Lucie Polanská",
      sellerAddress: "Putim 229, 397 01 Písek",
      sellerPhone: "",
      sellerEmail: "",
      sellerWeb: "",
    })
    expect(bytes.length).toBeGreaterThan(2000)
  })

  /* Dlouhé věnování nesmí natéct do patičky ani mimo stránku. */
  it("unese nejdelší povolené věnování", async () => {
    const bytes = await generateGiftVoucherPdf({
      ...vzor,
      dedication: "Ať Ti keramika dělá radost. ".repeat(18).slice(0, 500),
    })
    expect(bytes.length).toBeGreaterThan(2000)
  })

  it("název souboru nese kód a nemá diakritiku ani mezery", () => {
    expect(giftVoucherPdfFilename("KZ-7HQ4 M2XP")).toBe("darkovy-poukaz-KZ-7HQ4M2XP.pdf")
  })

  /* „v keramické dílně Lucie Polanské“ — jako na vytištěné kartičce. */
  it("skloňuje jméno majitelky do věty o dílně", () => {
    expect(dilnaGenitive("Lucie Polanská")).toBe("Lucie Polanské")
    expect(dilnaGenitive("Jana Nováková")).toBe("Jany Novákové")
    expect(dilnaGenitive("Keramická zahrada s.r.o.")).toBe("Keramické zahrady s.r.o.")
  })
})
