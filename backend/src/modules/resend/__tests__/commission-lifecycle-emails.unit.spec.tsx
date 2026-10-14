import { renderToStaticMarkup } from "react-dom/server"
import { CommissionConfirmedEmail } from "../emails/commission-confirmed"
import { OrderProcessingEmail } from "../emails/order-processing"

/**
 * E-maily zakázky po jednotlivých tlačítkách (14. 10. 2026): „Zadání je
 * potvrzené" při potvrzení zadání, „Výroba začíná" až při Začít výrobu.
 * Dřív šel „Výroba začíná" už při potvrzení a začátek výroby mlčel.
 */
describe("e-maily zakázky", () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

  it("Zadání je potvrzené — cena, záloha, doplatek a termín", () => {
    const out = text(
      renderToStaticMarkup(
        <CommissionConfirmedEmail
          customerName="Jana"
          orderNumber="#50"
          productTitle="Pán lesa Dub"
          totalPrice="4 500 Kč"
          depositPaid="1 125 Kč"
          balanceDue="3 375 Kč"
          estimatedCompletion="5. 11. 2026"
        />
      )
    )
    expect(out).toContain("Zadání je")
    expect(out).toContain("potvrzené.")
    expect(out).toContain("Pán lesa Dub")
    expect(out).toContain("Zaplaceno zálohou")
    expect(out).toContain("1 125 Kč")
    expect(out).toContain("Doplatíte po dokončení")
    expect(out).toContain("3 375 Kč")
    expect(out).toContain("5. 11. 2026")
    expect(out).not.toContain("Výroba právě začala")
  })

  it("Zadání je potvrzené — zaplacená zakázka a bez čísel", () => {
    const out = text(renderToStaticMarkup(<CommissionConfirmedEmail orderNumber="#51" />))
    expect(out).toContain("Zakázka je zaplacená")
    expect(out).not.toContain("Doplatíte")
  })

  it("Výroba začíná — s termínem dokončení", () => {
    const out = text(
      renderToStaticMarkup(
        <OrderProcessingEmail orderNumber="#50" estimatedCompletion="5. 11. 2026" />
      )
    )
    expect(out).toContain("Výroba")
    expect(out).toContain("začíná.")
    expect(out).toContain("pouštím do výroby vaší zakázky #50")
    expect(out).toContain("Předpokládané dokončení")
    expect(out).toContain("5. 11. 2026")
  })
})
