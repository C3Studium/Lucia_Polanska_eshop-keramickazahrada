import { renderToStaticMarkup } from "react-dom/server"
import { orderPlacedEmail } from "../emails/order-placed"
import { abandonedCartEmail } from "../emails/abandoned-cart"
import { OrderReviewEmail } from "../emails/order-review"
import { PriceDropEmail } from "../emails/price-drop"
import { PaymentPendingEmail } from "../emails/payment-pending"
import { PaymentRefundedEmail } from "../emails/payment-refunded"
import { OrderRefundedEmail } from "../emails/order-refunded"
import { OrderDeliveredEmail } from "../emails/order-delivered"
import { OrderShipmentEmail } from "../emails/order-shipment"
import { CP_CLAIM_FORM_URL } from "../../../lib/claims/constants"

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

    it("offers the online withdrawal link when the order allows it (§ 1830a OZ)", () => {
      const url = "https://keramickazahrada.cz/cz/order/order_01TEST/odstoupeni?token=abc"
      const html = renderToStaticMarkup(
        orderPlacedEmail({
          order,
          refund_url: "https://keramickazahrada.cz/cz/order/order_01TEST/refund?token=abc",
          withdrawal_url: url,
        }) as React.ReactElement
      )
      expect(html).toContain(url)
      expect(html).toContain("Odstoupit od smlouvy")

      const withoutLink = renderToStaticMarkup(
        orderPlacedEmail({
          order,
          refund_url: "https://keramickazahrada.cz/cz/order/order_01TEST/refund?token=abc",
          withdrawal_url: null,
        }) as React.ReactElement
      )
      expect(withoutLink).not.toContain("/odstoupeni?token=")
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

    describe("Smlouva a poučení (§ 1827 odst. 2 OZ)", () => {
      const seller = {
        name: "Lucie Polanská",
        address: "Putim 229, 397 01 Písek",
        ico: "03441482",
        email: "info@keramickazahrada.cz",
        phone: "+420 775 211 578",
        web: "keramickazahrada.cz",
        webUrl: "https://keramickazahrada.cz",
      }
      const doc = (slug: string, title: string, attached: boolean) => ({
        slug: slug as any,
        title,
        version: "2026-10-15",
        version_label: "15. 10. 2026",
        page_url:
          slug === "obchodni-podminky"
            ? "https://keramickazahrada.cz/cz/smluvni-podminky/2026-10-15"
            : `https://keramickazahrada.cz/cz/${slug}`,
        pdf_url: `https://img.example.cz/legal/${slug}-2026-10-15.pdf`,
        attached,
      })
      const legal = (attached: boolean, extra: Record<string, unknown> = {}) => ({
        seller,
        terms: doc("obchodni-podminky", "Obchodní podmínky", attached),
        withdrawal: doc("odstoupeni-od-smlouvy", "Odstoupení od smlouvy", attached),
        terms_url: "https://keramickazahrada.cz/cz/smluvni-podminky",
        withdrawal_url: "https://keramickazahrada.cz/cz/odstoupeni-od-smlouvy",
        complaints_url: "https://keramickazahrada.cz/cz/reklamacni-rad",
        privacy_url: "https://keramickazahrada.cz/cz/ochrana-osobnich-udaju",
        made_to_order_items: [],
        all_made_to_order: false,
        ...extra,
      })

      it("says the terms valid for this order are attached, with seller and links", () => {
        const html = renderToStaticMarkup(
          orderPlacedEmail({ order, legal: legal(true) }) as React.ReactElement
        )
        expect(html).toContain("Smlouva a poučení")
        expect(html).toContain("uzavření kupní smlouvy")
        expect(html).toContain(
          "V příloze posíláme obchodní podmínky platné pro tuto smlouvu a poučení o odstoupení od smlouvy s formulářem (PDF)"
        )
        expect(html).toContain("znění platné od 15. 10. 2026")
        expect(html).toContain("IČO 03441482")
        expect(html).toContain("https://keramickazahrada.cz/cz/smluvni-podminky/2026-10-15")
        expect(html).toContain("https://keramickazahrada.cz/cz/reklamacni-rad")
        expect(html).toContain("do 14 dnů od převzetí")
        expect(html).toContain("formulářem z přílohy")
        // Přiložené PDF se znovu neodkazuje.
        expect(html).not.toContain("stáhnout PDF")
      })

      it("falls back to links when the PDF could not be attached", () => {
        const html = renderToStaticMarkup(
          orderPlacedEmail({
            order,
            legal: legal(true),
            attachments_failed: true,
          }) as React.ReactElement
        )
        expect(html).not.toContain("V příloze posíláme")
        expect(html).toContain("ve znění platném od 15. 10. 2026")
        expect(html).toContain("stáhnout PDF")
        expect(html).toContain("https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf")
      })

      it("names the made-to-order items excluded from withdrawal (§ 1837 písm. d)", () => {
        const mixed = renderToStaticMarkup(
          orderPlacedEmail({
            order,
            legal: legal(true, { made_to_order_items: ["Domovní číslo na zakázku"] }),
          }) as React.ReactElement
        )
        expect(mixed).toContain("do 14 dnů od převzetí")
        expect(mixed).toContain("Výjimkou je zboží vyrobené podle vašeho zadání (Domovní číslo na zakázku)")
        expect(mixed).toContain("§ 1837 písm. d)")

        const pure = renderToStaticMarkup(
          orderPlacedEmail({
            order,
            legal: legal(true, {
              made_to_order_items: ["Domovní číslo na zakázku"],
              all_made_to_order: true,
            }),
          }) as React.ReactElement
        )
        expect(pure).toContain("nelze odstoupit ve 14denní lhůtě")
        expect(pure).not.toContain("do 14 dnů od převzetí")
      })

      it("a pure commission's „Správa objednávky“ does not promise a 14-day withdrawal", () => {
        const refund_url = "https://keramickazahrada.cz/cz/order/order_01TEST/refund?token=abc"
        const pure = renderToStaticMarkup(
          orderPlacedEmail({
            order,
            refund_url,
            // Workflow čisté zakázce odkaz na odstoupení nedá (§ 1837 písm. d).
            withdrawal_url: null,
            legal: legal(true, {
              made_to_order_items: ["Domovní číslo na zakázku"],
              all_made_to_order: true,
            }),
          }) as React.ReactElement
        )
        expect(pure).toContain("Správa objednávky")
        expect(pure).toContain("nelze odstoupit ve 14denní lhůtě")
        expect(pure).not.toContain("Odstoupit od smlouvy můžete do 14 dnů")

        // Běžná objednávka bez odkazu (nenastavený storefront) větu dál má.
        const regular = renderToStaticMarkup(
          orderPlacedEmail({ order, refund_url, withdrawal_url: null, legal: legal(true) }) as React.ReactElement
        )
        expect(regular).toContain("Odstoupit od smlouvy můžete do 14 dnů")
      })

      it("renders nothing of the section for an old notification row without legal data", () => {
        const html = renderToStaticMarkup(orderPlacedEmail({ order }) as React.ReactElement)
        expect(html).not.toContain("Smlouva a poučení")
      })
    })
  })

  describe("shared footer", () => {
    it("carries the seller identity and links to the legal documents", () => {
      const html = renderToStaticMarkup(orderPlacedEmail({ order: { id: "o", display_id: 1, currency_code: "czk", items: [] } as any }) as React.ReactElement)
      expect(html).toContain("Prodávající: Lucie Polanská · Putim 229, 397 01 Písek · IČO 03441482")
      expect(html).toContain('href="https://keramickazahrada.cz/cz/smluvni-podminky"')
      expect(html).toContain('href="https://keramickazahrada.cz/cz/reklamacni-rad"')
      expect(html).toContain('href="https://keramickazahrada.cz/cz/ochrana-osobnich-udaju"')
      expect(html).not.toContain("DOPLNIT")
    })

    it("drops the links when no storefront is configured", () => {
      delete process.env.STOREFRONT_PUBLIC_URL
      const html = renderToStaticMarkup(orderPlacedEmail({ order: { id: "o", display_id: 1, currency_code: "czk", items: [] } as any }) as React.ReactElement)
      expect(html).toContain("IČO 03441482")
      expect(html).not.toContain("/reklamacni-rad")
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

  // § 7 odst. 3 zák. 480/2004 Sb.: v každém e-mailu z oprávněného zájmu
  // odkaz, kterým další jedním kliknutím odmítnete (OP čl. XIV, Zásady).
  describe("opt-out line (review request, price drop, abandoned cart)", () => {
    const url = "https://api.example.cz/email-optout?email=jana%40example.cz&kind=x&token=t"
    const render = (element: unknown) => renderToStaticMarkup(element as React.ReactElement)
    const cases: Array<[string, (props: { unsubscribe_url?: string | null }) => unknown]> = [
      ["order-review", (props) => OrderReviewEmail({ orderNumber: "#42", ...props })],
      ["price-drop", (props) => PriceDropEmail({ productName: "Mísa", newPrice: "900 Kč", ...props })],
      ["abandoned-cart", (props) => abandonedCartEmail({ cart_id: "cart_1", items: [], ...props })],
    ]

    it.each(cases)("%s carries the one-click opt-out link when given", (_name, template) => {
      const html = render(template({ unsubscribe_url: url }))
      expect(html).toContain("Nechcete tyto e-maily?")
      expect(html).toContain("Odhlásit je jedním kliknutím")
      expect(html).toContain(url.replace(/&/g, "&amp;"))
    })

    it.each(cases)(
      "%s without a link still offers opting out by e-mail, never a dead link",
      (_name, template) => {
        for (const html of [render(template({})), render(template({ unsubscribe_url: null }))]) {
          expect(html).not.toContain("Odhlásit je jedním kliknutím")
          // § 7 odst. 3 zák. 480/2004 Sb.: možnost odmítnout v KAŽDÉ zprávě.
          expect(html).toContain("Nechcete tyto e-maily?")
          expect(html).toContain("mailto:info@keramickazahrada.cz")
        }
      }
    )

    it("price-drop no longer points to a non-existent account setting", () => {
      expect(render(PriceDropEmail({}))).not.toContain("v nastavení účtu")
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
      expect(html).not.toContain("České pošty o reklamacích")
    })

    it("keeps the carrier-damage claim available for courier deliveries", () => {
      const html = renderToStaticMarkup(
        OrderDeliveredEmail({
          orderNumber: "#42",
          shippedByCarrier: true,
        }) as React.ReactElement
      )
      expect(html).toContain("Dorazila zásilka poškozená")
      // 14. 10. 2026 (právní audit §4.1): poškození hlásí zákazník nám,
      // s dopravcem to řešíme my — žádná lhůta ani formulář pošty.
      expect(html).toContain("s dopravcem si to vyřešíme sami")
      expect(html).not.toContain(CP_CLAIM_FORM_URL)
      expect(html).not.toContain("dva pracovní dny")
    })

    it("nese odkaz Odstoupit od smlouvy, když ho subscriber pošle (§ 1830a)", () => {
      const url = "https://keramickazahrada.cz/cz/order/order_1/odstoupeni?token=abc"
      const html = renderToStaticMarkup(
        OrderDeliveredEmail({ orderNumber: "#42", withdrawalUrl: url }) as React.ReactElement
      )
      expect(html).toContain("Odstoupit od smlouvy")
      expect(html).toContain(url)
      // Čistá zakázka (§ 1837 písm. d): bez odkazu se odstavec nevykreslí.
      const without = renderToStaticMarkup(
        OrderDeliveredEmail({ orderNumber: "#42" }) as React.ReactElement
      )
      expect(without).not.toContain("online přes tlačítko")
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

    // 14. 10. 2026: kontrola obalu je prosba, ne podmínka; lhůta dopravce pryč.
    it("převzetí: prosba zkontrolovat obal, žádná lhůta 2 dnů pro zákazníka", () => {
      const html = renderToStaticMarkup(
        OrderShipmentEmail({ orderNumber: "#42" }) as React.ReactElement
      )
      expect(html).toContain("Podmínkou to ale není")
      expect(html).not.toContain("dvou pracovních dnů")
      expect(html).not.toContain("nepřijme")
    })

    it("nese odkaz Odstoupit od smlouvy jen s withdrawalUrl (§ 1830a)", () => {
      const url = "https://keramickazahrada.cz/cz/order/order_1/odstoupeni?token=abc"
      const html = renderToStaticMarkup(
        OrderShipmentEmail({ orderNumber: "#42", withdrawalUrl: url }) as React.ReactElement
      )
      expect(html).toContain("Odstoupit od smlouvy")
      expect(html).toContain(url)
      expect(
        renderToStaticMarkup(OrderShipmentEmail({ orderNumber: "#42" }) as React.ReactElement)
      ).not.toContain("online přes tlačítko")
    })
  })
})
