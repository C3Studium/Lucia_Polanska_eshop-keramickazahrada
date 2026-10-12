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
    // 12. 10. 2026, Matěj: u ČP reklamuje příjemce — pokyn, lhůta a odkaz.
    expect(html).not.toContain("reklamujeme u dopravce my")
    expect(html).toContain("podává příjemce")
    expect(html).toContain("2 pracovních dnů od doručení")
    expect(html).toContain(CP_CLAIM_FORM_URL)
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
        refundMethod: "na kartu přes ComGate — na účtu do 3–5 pracovních dnů",
        refundLines: "Zahradní mísa · 1 ks · 500 Kč\nPoštovné a balné · 129 Kč",
        creditNoteNumber: "DO-2026-3",
        creditNoteUrl: "https://files.example/dobropis-DO-2026-3.pdf",
      }) as React.ReactElement
    )
    expect(card).toContain("Zahradní mísa · 1 ks · 500 Kč")
    expect(card).toMatch(/500 Kč<br\s*\/?>/)
    expect(card).toContain("na kartu přes ComGate")
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
    expect(manual).toContain("vracíme ručně")
    expect(manual).toContain("vystaví až v ostrém režimu")
    expect(manual).not.toContain("Dobropis (PDF)")
  })

  it("order-refunded (§13.3): karta slibuje 3–5 dnů, ruční ne; košík a dobropis", () => {
    const card = renderToStaticMarkup(
      OrderRefundedEmail({
        orderNumber: "#42",
        refundAmount: "500 Kč",
        refundMethod: "na kartu přes ComGate — na účtu do 3–5 pracovních dnů",
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
