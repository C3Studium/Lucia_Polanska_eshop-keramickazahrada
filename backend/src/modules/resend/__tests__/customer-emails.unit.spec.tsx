import { renderToStaticMarkup } from "react-dom/server"
import { orderPlacedEmail } from "../emails/order-placed"
import { abandonedCartEmail } from "../emails/abandoned-cart"
import { PaymentPendingEmail } from "../emails/payment-pending"
import { PaymentRefundedEmail } from "../emails/payment-refunded"
import { OrderRefundedEmail } from "../emails/order-refunded"
import { OrderDeliveredEmail } from "../emails/order-delivered"
import { OrderShipmentEmail } from "../emails/order-shipment"

/**
 * Pins the audit fixes on the real rendered HTML — same renderer trade-off as
 * newsletter-blocks-email.unit.spec.tsx (react-dom's renderToStaticMarkup,
 * because @react-email/render dynamic-imports react-dom/server, which jest's
 * CJS sandbox refuses). Each test here is a bug that actually shipped:
 * a cart price 100× too small, a balance request claiming „není třeba nic
 * dělat", a refund note interpolated into a broken sentence, a refund amount
 * falling back to mock money, and a carrier-damage claim mailed to people
 * who carried their pottery home themselves.
 */

describe("customer e-mail templates after the audit", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  })

  afterAll(() => {
    process.env = env
  })

  describe("order-placed", () => {
    const order = {
      id: "order_01TEST",
      display_id: 42,
      currency_code: "czk",
      total: 1579,
      item_total: 1450,
      items: [
        {
          id: "ordli_1",
          product_title: "Zahradní mísa z pálené hlíny",
          variant_title: "Ø 32 cm",
          quantity: 1,
          total: 1450,
          thumbnail: null,
        },
      ],
      shipping_methods: [
        { id: "sm_1", name: "Zásilkovna", total: 129, data: {} },
      ],
      shipping_address: {
        first_name: "Jana",
        last_name: "Nováková",
        address_1: "Putim 229",
        address_2: "",
        city: "Písek",
        postal_code: "397 01",
      },
      customer: { first_name: "Jana", last_name: "Nováková" },
    } as any

    it("shows the delivery address, payment method and an order button", () => {
      const html = renderToStaticMarkup(
        orderPlacedEmail({
          order,
          payment_method: "Dobírka — zaplatíte při převzetí",
        }) as React.ReactElement
      )

      expect(html).toContain("Putim 229")
      expect(html).toContain("397 01 Písek")
      expect(html).toContain("Dobírka — zaplatíte při převzetí")
      expect(html).toContain(
        "https://keramickazahrada.cz/cz/order/order_01TEST/confirmed"
      )
      expect(html).toContain("Zobrazit objednávku")
    })

    it("references the display number, not the internal order id", () => {
      const html = renderToStaticMarkup(
        orderPlacedEmail({ order }) as React.ReactElement
      )
      expect(html).toContain("#42")
      expect(html).not.toContain(
        "komunikaci: order_01TEST"
      )
    })

    it("says 'osobní odběr' instead of an address for pickup orders", () => {
      const pickupOrder = {
        ...order,
        shipping_methods: [
          { id: "sm_1", name: "Osobní odběr", total: 0, data: { personal_pickup: true } },
        ],
      }
      const html = renderToStaticMarkup(
        orderPlacedEmail({ order: pickupOrder }) as React.ReactElement
      )
      expect(html).toContain("Osobní odběr v ateliéru")
      expect(html).not.toContain("Doručovací adresa")
    })
  })

  describe("abandoned-cart", () => {
    it("renders cart prices as major units — no /100 shrinkage", () => {
      const html = renderToStaticMarkup(
        abandonedCartEmail({
          customer: { first_name: "Jan" },
          cart_id: "cart_1",
          currency_code: "czk",
          items: [
            { product_title: "Keramický talíř", quantity: 1, unit_price: 450 },
          ],
        }) as React.ReactElement
      )
      expect(html).toContain("450")
      expect(html).not.toContain("4,50")
    })
  })

  describe("payment-pending (the balance request)", () => {
    it("asks for the payment and links the payment URL, not a status report", () => {
      const html = renderToStaticMarkup(
        PaymentPendingEmail({
          customerName: "Jan Novák",
          orderNumber: "#42",
          paymentAmount: "2 450 Kč",
          paymentLink: "https://keramickazahrada.cz/cz/pay/abc",
        }) as React.ReactElement
      )
      expect(html).toContain("doplatek")
      expect(html).toContain("https://keramickazahrada.cz/cz/pay/abc")
      expect(html).toContain("Zaplatit 2 450 Kč")
      // The old copy told the customer the exact opposite of what was needed.
      expect(html).not.toContain("Není třeba nic dělat")
    })

    it("still honours the legacy orderLink payload as the payment URL", () => {
      const html = renderToStaticMarkup(
        PaymentPendingEmail({
          orderNumber: "#42",
          orderLink: "https://keramickazahrada.cz/cz/pay/legacy",
        }) as React.ReactElement
      )
      expect(html).toContain("https://keramickazahrada.cz/cz/pay/legacy")
    })
  })

  describe("payment-refunded", () => {
    it("renders the subscriber's whole-sentence timing without splicing", () => {
      const html = renderToStaticMarkup(
        PaymentRefundedEmail({
          orderNumber: "#42",
          refundAmount: "500 Kč",
          estimatedRefundTime:
            "Peníze se obvykle vrátí do několika pracovních dnů.",
        }) as React.ReactElement
      )
      expect(html).toContain(
        "Peníze se obvykle vrátí do několika pracovních dnů."
      )
      // The old template produced „…měly objevit do Peníze se obvykle…".
      expect(html).not.toContain("objevit do Peníze")
    })

    it("does not invent a refund reason", () => {
      const html = renderToStaticMarkup(
        PaymentRefundedEmail({ orderNumber: "#42" }) as React.ReactElement
      )
      expect(html).not.toContain("Částečné vrácení zboží")
    })
  })

  describe("order-refunded", () => {
    it("never falls back to mock money when the amount is missing", () => {
      const html = renderToStaticMarkup(
        OrderRefundedEmail({ orderNumber: "#42" }) as React.ReactElement
      )
      expect(html).not.toContain("1 250")
      expect(html).not.toContain("Požadavek zákazníka")
    })

    it("renders the formatted amount the caller sends", () => {
      const html = renderToStaticMarkup(
        OrderRefundedEmail({
          orderNumber: "#42",
          refundAmount: "320,00 Kč",
          refundReason: "Vrácení rozdílu po úpravě objednávky",
        }) as React.ReactElement
      )
      expect(html).toContain("320,00 Kč")
      expect(html).toContain("Vrácení rozdílu po úpravě objednávky")
    })
  })

  describe("order-delivered (personal pickup handover)", () => {
    it("does not talk about damaged parcels to someone who carried it home", () => {
      const html = renderToStaticMarkup(
        OrderDeliveredEmail({
          customerName: "Jana Nováková",
          orderNumber: "#42",
        }) as React.ReactElement
      )
      expect(html).not.toContain("Dorazila zásilka poškozená")
      expect(html).not.toContain("eReklamaci")
    })

    it("keeps the carrier-damage claim available for courier deliveries", () => {
      const html = renderToStaticMarkup(
        OrderDeliveredEmail({
          orderNumber: "#42",
          shippedByCarrier: true,
        }) as React.ReactElement
      )
      expect(html).toContain("Dorazila zásilka poškozená")
    })
  })

  describe("order-shipment", () => {
    it("invents neither a tracking number nor a delivery estimate", () => {
      const html = renderToStaticMarkup(
        OrderShipmentEmail({
          customerName: "Jan Novák",
          orderNumber: "#42",
          carrierName: "Zásilkovna",
          trackingNumber: "",
          trackingLink: "",
          orderLink: "https://keramickazahrada.cz/cz/order/order_1/confirmed",
        }) as React.ReactElement
      )
      expect(html).not.toContain("CZ123456789")
      expect(html).not.toContain("2-3 pracovní dny")
      expect(html).toContain("Zásilkovna")
    })
  })
})
