import { renderToStaticMarkup } from "react-dom/server"
import { RefundRequestEmail } from "../emails/refund-request"
import { ReturnApprovedEmail } from "../emails/return-approved"
import { ReturnRejectedEmail } from "../emails/return-rejected"
import { ReturnResolvedEmail } from "../emails/return-resolved"

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
    expect(html).toContain("reklamujeme u dopravce my")
  })

  it("refund-request bez příčiny o dopravci mlčí", () => {
    const html = renderToStaticMarkup(
      RefundRequestEmail({ orderNumber: "#42", kind: "reklamace", items: ITEMS }) as React.ReactElement
    )
    expect(html).not.toContain("Poškozeno přepravou")
    expect(html).not.toContain("dopravce")
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
