import { renderToStaticMarkup } from "react-dom/server"
import { OrderRefundedEmail } from "../emails/order-refunded"
import { RefundRequestEmail } from "../emails/refund-request"
import { ReturnApprovedEmail } from "../emails/return-approved"
import { ReturnRejectedEmail } from "../emails/return-rejected"
import { ReturnResolvedEmail } from "../emails/return-resolved"
import { CP_CLAIM_FORM_URL } from "../../../lib/claims/constants"

/**
 * E-maily modulu „Reklamace a zrušení" po §11 (docs/reklamace-a-zruseni.md):
 * seznam položek řádek po řádku a věta „Poškozeno přepravou". Stejný renderer
 * jako customer-emails.unit.spec.tsx (react-dom, ne @react-email/render).
 */

const ITEMS = "Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč\nKeramický hrnek · 1 ks · 390 Kč"

describe("claim e-mails — položky a poškození přepravou", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
  })

  afterAll(() => {
    process.env = env
  })

  it("refund-request: položky na samostatných řádcích + příčina „Poškozeno přepravou“", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({
        orderNumber: "#42",
        kind: "reklamace",
        refundReason: "Rozbité při doručení",
        items: ITEMS,
        carrierDamage: true,
      }) as React.ReactElement
    )
    expect(html).toContain("Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč")
    expect(html).toContain("Keramický hrnek · 1 ks · 390 Kč")
    expect(html).toMatch(/1 305 Kč<br\s*\/?>/)
    expect(html).toContain("Poškozeno přepravou")
    // 14. 10. 2026 (právní audit §4.1): s dopravcem to řešíme my; obal a fotky
    // jsou prosba, lhůta pošty ani její formulář zákazníka nezavazují.
    expect(html).toContain("řešíme s Českou poštou my")
    expect(html).toContain("nijak nepodmiňuje")
    expect(html).not.toContain("podává příjemce")
    expect(html).not.toContain("2 pracovních dnů")
    expect(html).not.toContain(CP_CLAIM_FORM_URL)
  })

  it("refund-request bez příčiny o dopravci mlčí", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({ orderNumber: "#42", kind: "reklamace", items: ITEMS }) as React.ReactElement
    )
    expect(html).not.toContain("Poškozeno přepravou")
    expect(html).not.toContain("dopravce")
    expect(html).not.toContain(CP_CLAIM_FORM_URL)
  })

  it("refund-request u vrácení zboží vypíše vracené položky (12. 10. 2026)", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({
        orderNumber: "#42",
        kind: "vraceni",
        refundReason: "Vrácení zboží",
        items: ITEMS,
      }) as React.ReactElement
    )
    expect(html).toContain("Žádost o vrácení")
    expect(html).toContain("Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč")
    expect(html).toContain("Keramický hrnek · 1 ks · 390 Kč")
  })

  it("refund-request u vrácení nese datum a čas odeslání", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({
        orderNumber: "#42",
        kind: "vraceni",
        items: ITEMS,
        submittedAt: "15. 10. 2026 v 14:32",
        submittedChannel: "online na webu obchodu",
      }) as React.ReactElement
    )
    expect(html).toContain("Odesláno")
    expect(html).toContain("15. 10. 2026 v 14:32")
    expect(html).toContain("online na webu obchodu")
  })

  it("return-approved: bere approvedItems, nebo items ze společného základu", () => {
    const fromBase = renderToStaticMarkup(
      ReturnApprovedEmail({
        orderNumber: "#42",
        kind: "reklamace",
        resolution: "refund",
        items: ITEMS,
        carrierDamage: true,
      }) as React.ReactElement
    )
    expect(fromBase).toContain("Keramický hrnek · 1 ks · 390 Kč")
    expect(fromBase).toContain("Poškozeno přepravou")

    const legacy = renderToStaticMarkup(
      ReturnApprovedEmail({
        orderNumber: "#42",
        kind: "vraceni",
        resolution: "refund",
        approvedItems: "modrý hrnek",
      }) as React.ReactElement
    )
    expect(legacy).toContain("modrý hrnek")
    expect(legacy).not.toContain("Poškozeno přepravou")
  })

  it("return-resolved: potvrzení nese položky i příčinu", () => {
    const html = renderToStaticMarkup(
      ReturnResolvedEmail({
        orderNumber: "#42",
        kind: "reklamace",
        resolution: "refund",
        resolvedAt: "9. 10. 2026",
        refundAmount: "1 695 Kč",
        items: ITEMS,
        carrierDamage: true,
      }) as React.ReactElement
    )
    expect(html).toContain("Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč")
    expect(html).toContain("Poškozeno přepravou")
    expect(html).toContain("1 695 Kč")
  })

  it("return-resolved (§13.3): košík, způsob, dobropis s odkazem; ručně = bez slibu 3–5 dnů", () => {
    const card = renderToStaticMarkup(
      ReturnResolvedEmail({
        orderNumber: "#42",
        kind: "odstoupeni",
        resolution: "refund",
        resolvedAt: "10. 10. 2026",
        refundAmount: "629 Kč",
        refundMethod: "stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů",
        refundLines: "Zahradní mísa · 1 ks · 500 Kč\nPoštovné a balné · 129 Kč",
        creditNoteNumber: "DO-2026-3",
        creditNoteUrl: "https://files.example/dobropis-DO-2026-3.pdf",
      }) as React.ReactElement
    )
    expect(card).toContain("Zahradní mísa · 1 ks · 500 Kč")
    expect(card).toMatch(/500 Kč<br\s*\/?>/)
    expect(card).toContain("stejnou cestou, jakou jste platili (přes ComGate)")
    expect(card).toContain("č. DO-2026-3")
    expect(card).toContain("https://files.example/dobropis-DO-2026-3.pdf")
    expect(card).toContain("3–5 pracovních dnů")

    const manual = renderToStaticMarkup(
      ReturnResolvedEmail({
        orderNumber: "#42",
        kind: "vraceni",
        resolution: "refund",
        refundAmount: "500 Kč",
        refundMethod: "ručně",
        creditNoteNote: "Opravný daňový doklad (dobropis): Zkušební režim — dobropis se vystaví až v ostrém režimu.",
      }) as React.ReactElement
    )
    expect(manual).not.toContain("3–5 pracovních dnů")
    expect(manual).toContain("vracím ručně")
    expect(manual).toContain("vystaví až v ostrém režimu")
    expect(manual).not.toContain("Dobropis (PDF)")
  })

  it("order-refunded (§13.3): karta slibuje 3–5 dnů, ruční ne; košík a dobropis", () => {
    const card = renderToStaticMarkup(
      OrderRefundedEmail({
        orderNumber: "#42",
        refundAmount: "500 Kč",
        refundMethod: "stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů",
        refundLines: "Zahradní mísa · 1 ks · 500 Kč",
        creditNoteNumber: "DO-2026-4",
        creditNoteUrl: "https://files.example/do4.pdf",
      }) as React.ReactElement
    )
    expect(card).toContain("do 3–5 pracovních dnů")
    expect(card).toContain("Zahradní mísa · 1 ks · 500 Kč")
    expect(card).toContain("č. DO-2026-4")
    expect(card).toContain("https://files.example/do4.pdf")

    const manual = renderToStaticMarkup(
      OrderRefundedEmail({ orderNumber: "#42", refundAmount: "500 Kč", refundMethod: "ručně" }) as React.ReactElement
    )
    expect(manual).not.toContain("3–5 pracovních dnů")
    expect(manual).toContain("ručně")

    // Starší volající bez způsobu: původní text zůstává.
    const legacy = renderToStaticMarkup(
      OrderRefundedEmail({ orderNumber: "#42", refundAmount: "500 Kč" }) as React.ReactElement
    )
    expect(legacy).toContain("do 3–5 pracovních dnů")
  })

  it("poškozený kus (§13.7): věta v přijetí, schválení i potvrzení", () => {
    for (const html of [
      renderToStaticMarkup(
        RefundRequestEmail({ orderNumber: "#42", kind: "reklamace", damagedItem: true }) as React.ReactElement
      ),
      renderToStaticMarkup(
        ReturnApprovedEmail({ orderNumber: "#42", kind: "reklamace", resolution: "repair", damagedItem: true }) as React.ReactElement
      ),
      renderToStaticMarkup(
        ReturnResolvedEmail({ orderNumber: "#42", kind: "reklamace", resolution: "repair", damagedItem: true }) as React.ReactElement
      ),
    ]) {
      expect(html).toContain("Poškozený kus")
      expect(html).not.toContain("Poškozeno přepravou")
    }
  })

  it("return-rejected: položky řádek po řádku", () => {
    const html = renderToStaticMarkup(
      ReturnRejectedEmail({
        orderNumber: "#42",
        kind: "reklamace",
        rejectionReason: "mechanické poškození",
        items: ITEMS,
      }) as React.ReactElement
    )
    expect(html).toMatch(/1 305 Kč<br\s*\/?>/)
    expect(html).toContain("Keramický hrnek · 1 ks · 390 Kč")
  })
})

/**
 * Potvrzení odstoupení online (§ 1830a OZ, NV 29/2023 pokyn [4]) a přijetí
 * reklamace (§ 19 odst. 1 ZOS) — obsah + datum a čas odeslání (14. 10. 2026).
 */
describe("refund-request — potvrzení odstoupení a reklamace s datem a časem", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
  })

  afterAll(() => {
    process.env = env
  })

  const withdrawal = {
    customerName: "Jana Nováková",
    orderNumber: "#42",
    kind: "odstoupeni",
    submittedAt: "15. 10. 2026 v 14:32",
    submittedChannel: "online na webu obchodu",
    orderDate: "3. 10. 2026",
    takeoverText: "7. 10. 2026",
    items: "Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč",
    refundMethodText: "Převodem na účet ••••5399/0800, který jste uvedli (objednávku jste neplatili kartou).",
    returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
    deadlineText: "nejpozději do 29. 10. 2026 (14 dnů od odstoupení)",
  }

  it("odstoupení: potvrzení přijetí, celý obsah, datum a čas, další kroky", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({ ...withdrawal, wholeOrder: true, goodsShipped: true }) as React.ReactElement
    )
    expect(html).toContain("Potvrzuji přijetí")
    expect(html).toContain("potvrzuji přijetí vašeho odstoupení od kupní smlouvy")
    // datum a čas odeslání + kanál
    expect(html).toContain("15. 10. 2026 v 14:32")
    expect(html).toContain("online na webu obchodu")
    // obsah prohlášení
    expect(html).toContain("#42")
    expect(html).toContain("3. 10. 2026")
    expect(html).toContain("7. 10. 2026")
    expect(html).toContain("Odstupujete od")
    expect(html).toContain("Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč")
    expect(html).toContain("odstoupení od celé smlouvy")
    expect(html).toContain("••••5399/0800")
    expect(html).not.toContain("2000145399")
    // další kroky: vrácení zboží do 14 dnů na adresu, peníze do 14 dnů vč.
    // nejlevnějšího dodání, smíme počkat na zboží, § 1833
    expect(html).toContain("Lucie Polanská, Putim 229, 397 01 Písek")
    expect(html).toContain("do 14 dnů od")
    expect(html).toContain("nejlevnějšího způsobu dodání")
    expect(html).toContain("prokážete, že jste ho odeslali")
    expect(html).toContain("snížení hodnoty")
    // důvod se bez textu zákazníka nevypisuje
    expect(html).not.toContain(">Důvod<")
  })

  it("odstoupení jen od části: bez slibu poštovného, s vyjmutou zakázkou a důvodem", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({
        ...withdrawal,
        wholeOrder: false,
        goodsShipped: true,
        refundReason: "Barva neodpovídá interiéru",
        excludedItems: "Domovní číslo · 1 ks · 1 200 Kč",
      }) as React.ReactElement
    )
    expect(html).toContain("odstoupení jen od uvedeného zboží")
    expect(html).not.toContain("nejlevnějšího způsobu dodání")
    expect(html).toContain("Barva neodpovídá interiéru")
    expect(html).toContain("Domovní číslo · 1 ks · 1 200 Kč")
    expect(html).toContain("§ 1837 písm. d)")
  })

  it("odstoupení před odesláním: nic neposílat; auto-zrušení řekne, že objednávka je zrušená", () => {
    const unshipped = renderToStaticMarkup(
      RefundRequestEmail({ ...withdrawal, wholeOrder: true, goodsShipped: false }) as React.ReactElement
    )
    expect(unshipped).toContain("zboží jsem ještě neodeslala")
    expect(unshipped).not.toContain("Lucie Polanská, Putim 229")

    const cancelled = renderToStaticMarkup(
      RefundRequestEmail({
        ...withdrawal,
        wholeOrder: true,
        goodsShipped: false,
        autoCancelled: true,
        refundMethodText: "Zatím jste nic nezaplatili — není co vracet.",
      }) as React.ReactElement
    )
    expect(cancelled).toContain("Objednávka je zrušená")
    // i tak potvrzení přijetí s datem a časem odeslání (§ 1830a)
    expect(cancelled).toContain("Potvrzuji přijetí")
    expect(cancelled).toContain("15. 10. 2026 v 14:32")
    expect(cancelled).toContain("Zahradní mísa")

    // Odesláno na dobírku, ještě nezaplaceno: zboží vrátit, peníze se neslibují.
    const unpaid = renderToStaticMarkup(
      RefundRequestEmail({ ...withdrawal, wholeOrder: true, goodsShipped: true, nothingToRefund: true }) as React.ReactElement
    )
    expect(unpaid).toContain("Lucie Polanská, Putim 229, 397 01 Písek")
    expect(unpaid).toContain("není co vracet")
    expect(unpaid).not.toContain("Peníze smím vrátit")
  })

  it("reklamace (§ 19 ZOS): datum a čas uplatnění, obsah, požadavek, 30 dnů od uplatnění", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({
        orderNumber: "#42",
        kind: "reklamace",
        submittedAt: "15. 10. 2026 v 14:32",
        submittedChannel: "online na webu obchodu",
        items: ITEMS,
        refundReason: "Prasklina na glazuře po prvním použití",
        requestedResolution: "výměna za nový kus",
        deadlineText: "nejpozději do 14. 11. 2026 (30 dnů od uplatnění reklamace)",
        protocolUrl: "https://files.example/REK-2026-42.pdf",
        claimsUrl: "https://keramickazahrada.cz/cz/order/order_42/claims?token=abc",
      }) as React.ReactElement
    )
    expect(html).toContain("Uplatněno")
    expect(html).toContain("15. 10. 2026 v 14:32")
    expect(html).toContain("Popis vady")
    expect(html).toContain("Prasklina na glazuře po prvním použití")
    expect(html).toContain("Keramický hrnek · 1 ks · 390 Kč")
    expect(html).toContain("výměna za nový kus")
    expect(html).toContain("14. 11. 2026 (30 dnů od uplatnění reklamace)")
    expect(html).toContain("písemným potvrzením o jejím uplatnění")
    // Protokol je odkaz ke stažení, ne příloha.
    expect(html).not.toContain("Přiložený protokol")
    expect(html).toContain("https://files.example/REK-2026-42.pdf")
  })
})
