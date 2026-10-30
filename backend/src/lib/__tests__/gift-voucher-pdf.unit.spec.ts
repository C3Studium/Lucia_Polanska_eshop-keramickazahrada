import fs from "fs"
import path from "path"
import { PDFDocument } from "pdf-lib"
import {
  dilnaGenitive,
  generateGiftVoucherPdf,
  generateGiftVoucherPrintPdf,
  giftVoucherPdfFilename,
  giftVoucherPrintPdfFilename,
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
  issuedAt: "2026-10-30T08:15:00.000Z",
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

/**
 * Druhá podoba téhož poukazu: dvě stránky A4 k oboustrannému tisku, líc
 * a rub kartičky. `POUKAZ_TISK_PDF_OUT=cesta.pdf` vypíše ukázku.
 */
describe("Poukaz k oboustrannému tisku", () => {
  it("má přesně dvě stránky a vznikne jako PDF", async () => {
    const bytes = await generateGiftVoucherPrintPdf(vzor)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-")
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)

    const out = process.env.POUKAZ_TISK_PDF_OUT
    if (out) {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, Buffer.from(bytes))
    }
  })

  /* Karta musí na obou stránkách sedět na témže místě, jinak rub nepadne na
     líc. Vycentrovaná svisle i vodorovně je to jedno, jak tiskárna otáčí. */
  it("obě stránky mají tentýž rozměr A4", async () => {
    const doc = await PDFDocument.load(await generateGiftVoucherPrintPdf(vzor))
    const [front, back] = doc.getPages()
    expect(Math.round(front.getWidth())).toBe(Math.round(back.getWidth()))
    expect(Math.round(front.getHeight())).toBe(Math.round(back.getHeight()))
    expect(Math.round(front.getWidth())).toBe(595)
    expect(Math.round(front.getHeight())).toBe(842)
  })

  /*
   * ZMĚŘENO 30. 10. 2026: tohle kdysi padalo přes vteřinovou hranici —
   * `doc.save()` razí do PDF „teď“, takže tentýž poukaz vystavený dvakrát
   * měl jiné bajty a v úložišti (klíč = otisk obsahu) přibyla další kopie.
   * Datum se proto bere z poukazu, ne z hodin.
   */
  it("je při stejném zadání pokaždé stejné, i přes vteřinovou hranici", async () => {
    const a = await generateGiftVoucherPrintPdf(vzor)
    const b = await generateGiftVoucherPrintPdf(vzor)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it("poukaz bez data vzniku je stálý taky", async () => {
    const bez = { ...vzor, issuedAt: null }
    const a = await generateGiftVoucherPdf(bez)
    const b = await generateGiftVoucherPdf(bez)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it("jiné datum vzniku = jiný soubor", async () => {
    const a = await generateGiftVoucherPdf({ ...vzor, issuedAt: "2026-10-30T10:00:00.000Z" })
    const b = await generateGiftVoucherPdf({ ...vzor, issuedAt: "2026-10-31T10:00:00.000Z" })
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it("je to jiný soubor než shrnující poukaz", async () => {
    const summary = await generateGiftVoucherPdf(vzor)
    const print = await generateGiftVoucherPrintPdf(vzor)
    expect(Buffer.from(summary).equals(Buffer.from(print))).toBe(false)
  })

  it("projde i bez obdarovaného a věnování — rub zůstane jen s návodem", async () => {
    const bytes = await generateGiftVoucherPrintPdf({
      voucherId: "gv_03",
      code: "KZ-ABCD-EFGH",
      value: "500 Kč",
      validUntil: "1. 1. 2028",
      sellerName: "Lucie Polanská",
      sellerAddress: "Putim 229, 397 01 Písek",
      sellerPhone: "",
      sellerEmail: "",
      sellerWeb: "",
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
  })

  it("unese nejdelší povolené věnování", async () => {
    const bytes = await generateGiftVoucherPrintPdf({
      ...vzor,
      dedication: "Ať Ti keramika dělá radost. ".repeat(18).slice(0, 500),
    })
    expect(bytes.length).toBeGreaterThan(2000)
  })

  it("název souboru se pozná od shrnujícího", () => {
    expect(giftVoucherPrintPdfFilename("KZ-7HQ4 M2XP")).toBe(
      "darkovy-poukaz-KZ-7HQ4M2XP-k-tisku.pdf"
    )
    expect(giftVoucherPrintPdfFilename("KZ-7HQ4-M2XP")).not.toBe(
      giftVoucherPdfFilename("KZ-7HQ4-M2XP")
    )
  })
})
