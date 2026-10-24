import { renderToStaticMarkup } from "react-dom/server"
import { PaymentReceivedEmail } from "../emails/payment-received"
import { PaymentFailedEmail } from "../emails/payment-failed"
import { OrderRefundedEmail } from "../emails/order-refunded"
import { emailLineItems, refundEmailLineItems } from "../../../lib/email-items"
import { PACKAGING_MARKER, PACKAGING_VARIANT_KEY } from "../../../lib/packaging-lines"

/**
 * „Za co ta platba byla" (24. 10. 2026).
 *
 * E-mail o platbě uváděl číslo objednávky, způsob platby a částku — a nic
 * o tom, co si zákazník koupil. Tahle sada drží obě poloviny: že se řádky
 * poskládají ze skutečné objednávky (včetně balného a množství, které u
 * objednávky nežije na řádku) a že je šablony opravdu vykreslí, s fotkou
 * u zboží a bez fotky tam, kde žádná není.
 */

describe("za co ta platba byla — řádky z objednávky", () => {
  const order = {
    currency_code: "czk",
    items: [
      {
        id: "ordli_1",
        product_title: "Zahradní mísa z pálené hlíny",
        variant_title: "Ø 32 cm",
        variant_id: "variant_1",
        product_id: "prod_1",
        quantity: 2,
        total: 2900,
        thumbnail: "https://img.matejforejt.com/misa.jpg",
      },
      {
        id: "ordli_2",
        title: "Balné",
        quantity: 2,
        total: 60,
        metadata: { [PACKAGING_MARKER]: true, [PACKAGING_VARIANT_KEY]: "variant_1" },
      },
      {
        id: "ordli_3",
        product_title: "Miska na mýdlo",
        variant_title: "Default variant",
        variant_id: "variant_2",
        product_id: "prod_2",
        quantity: 1,
        total: 340,
        thumbnail: null,
      },
    ],
  } as any

  it("vypíše zboží s provedením, množstvím, cenou a fotkou", () => {
    const [misa] = emailLineItems(order)
    expect(misa.title).toBe("Zahradní mísa z pálené hlíny")
    expect(misa.subtitle).toBe("Ø 32 cm")
    expect(misa.quantity).toBe(2)
    expect(misa.thumbnail).toBe("https://img.matejforejt.com/misa.jpg")
    expect(misa.amount).toContain("Kč")
    expect(misa.amount?.replace(/\s/g, "")).toContain("2900")
    expect(misa.service).toBeUndefined()
  })

  it("balné je servisní řádek pojmenovaný po svém výrobku a stojí hned pod ním", () => {
    const radky = emailLineItems(order)
    expect(radky[1].service).toBe(true)
    expect(radky[1].title).toBe("Balné — Zahradní mísa z pálené hlíny")
    expect(radky[1].thumbnail).toBeNull()
  })

  it("výchozí provedení Medusy se nevypisuje jako varianta", () => {
    expect(emailLineItems(order)[2].subtitle).toBeNull()
  })

  it("bez položek nevrací nic — prázdná sekce je horší než žádná", () => {
    expect(emailLineItems({ items: [], currency_code: "czk" })).toEqual([])
    expect(emailLineItems(null)).toEqual([])
  })

  /*
   * Množství objednávky nežije na řádku, ale na jeho detailu
   * (lib/order-quantity) — kdyby se tahle cesta přestala čtout, e-mail by
   * u dvou kusů tvrdil jeden.
   */
  it("čte množství i z detailu řádku", () => {
    const radky = emailLineItems({
      currency_code: "czk",
      items: [
        {
          id: "ordli_9",
          product_title: "Hrnek",
          variant_id: "variant_9",
          product_id: "prod_9",
          detail: { quantity: 3 },
          total: 900,
        },
      ],
    } as any)
    expect(radky[0].quantity).toBe(3)
  })

  it("řádky refundace berou fotku z objednávky, poštovné jde bez fotky", () => {
    const radky = refundEmailLineItems(
      order,
      [
        { type: "item", line_item_id: "ordli_1", title: "Zahradní mísa", quantity: 1, amount: 1450 },
        { type: "shipping", title: "Poštovné", amount: 90 },
      ],
      "czk"
    )
    expect(radky[0].thumbnail).toBe("https://img.matejforejt.com/misa.jpg")
    expect(radky[0].subtitle).toBe("Ø 32 cm")
    expect(radky[1].service).toBe(true)
    expect(radky[1].thumbnail).toBeNull()
  })
})

describe("za co ta platba byla — ve vykreslených e-mailech", () => {
  const items = emailLineItems({
    currency_code: "czk",
    items: [
      {
        id: "ordli_1",
        product_title: "Zahradní mísa z pálené hlíny",
        variant_title: "Ø 32 cm",
        variant_id: "variant_1",
        product_id: "prod_1",
        quantity: 1,
        total: 1450,
        thumbnail: "https://img.matejforejt.com/misa.jpg",
      },
    ],
  } as any)

  it("platba přijata řekne za co, i s fotkou", () => {
    const html = renderToStaticMarkup(
      <PaymentReceivedEmail
        orderNumber="#42"
        paymentAmount="1 450,00 Kč"
        paymentMethod="Online platba"
        paidFor={items}
      />
    )
    expect(html).toContain("Za co jste zaplatili")
    expect(html).toContain("Zahradní mísa z pálené hlíny")
    expect(html).toContain("https://img.matejforejt.com/misa.jpg")
  })

  it("u doplatku zakázky se výpis jmenuje doplatek", () => {
    const html = renderToStaticMarkup(
      <PaymentReceivedEmail
        orderNumber="#42"
        paidFor={items}
        commissionPayments={{
          deposit: "1 000,00 Kč",
          balance: "1 450,00 Kč",
          surcharge: null,
          totalPaid: "2 450,00 Kč",
          depositInvoiceNumber: null,
        } as any}
      />
    )
    expect(html).toContain("Za co je doplatek")
  })

  it("bez položek žádnou sekci nepřidá", () => {
    const html = renderToStaticMarkup(
      <PaymentReceivedEmail orderNumber="#42" paymentAmount="1 450,00 Kč" />
    )
    expect(html).not.toContain("Za co jste zaplatili")
  })

  it("platba neprošla z pokladny mluví o košíku", () => {
    const html = renderToStaticMarkup(
      <PaymentFailedEmail checkout paymentAmount="1 450,00 Kč" paidFor={items} />
    )
    expect(html).toContain("Co máte v košíku")
    expect(html).toContain("Zahradní mísa z pálené hlíny")
  })

  it("platba neprošla u objednávky mluví o platbě", () => {
    const html = renderToStaticMarkup(
      <PaymentFailedEmail orderNumber="#42" paidFor={items} />
    )
    expect(html).toContain("Za co platba byla")
  })

  /* S fotkami by textový řádek „Vrácené položky" stál v e-mailu podruhé. */
  it("vracíme peníze s fotkami vynechá textový výpis položek", () => {
    const sFotkami = renderToStaticMarkup(
      <OrderRefundedEmail
        orderNumber="#42"
        refundAmount="1 450,00 Kč"
        refundLines={"Zahradní mísa · 1 ks · 1 450,00 Kč"}
        paidFor={items}
      />
    )
    expect(sFotkami).toContain("Za co vracíme peníze")
    expect(sFotkami).not.toContain("Vrácené položky")

    const bezFotek = renderToStaticMarkup(
      <OrderRefundedEmail
        orderNumber="#42"
        refundAmount="1 450,00 Kč"
        refundLines={"Zahradní mísa · 1 ks · 1 450,00 Kč"}
      />
    )
    expect(bezFotek).toContain("Vrácené položky")
  })
})
