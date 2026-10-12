import {
  adminOrderUrl,
  buildOrderChangeNotification,
  isDialablePhone,
} from "../order-change-request"

/**
 * „Potřebuji změnit objednávku" (12. 10. 2026, Matěj) — e-mail majitelce musí
 * na první pohled říct, že jde o změnu objednávky #N, a nést kontakt, odkaz
 * do administrace a zprávu zákazníka.
 */

const order = {
  id: "order_01ABC",
  display_id: 42,
  email: "jana@example.cz",
  customer_name: "Jana Nováková",
}

describe("buildOrderChangeNotification", () => {
  it("předmět jmenuje změnu objednávky s číslem, tělo nese kontakt, odkaz a zprávu", () => {
    const n = buildOrderChangeNotification(
      order,
      { phone: " +420 603 123 456 ", message: "  Chtěla bych ještě jeden hrnek.  " },
      "https://admin.example.cz/app/orders/order_01ABC"
    )
    expect(n.title).toBe("Žádost o změnu objednávky #42")
    expect(n.description).toContain("změnu objednávky #42")
    expect(n.description).toContain("Jana Nováková <jana@example.cz>")
    expect(n.description).toContain("Telefon: +420 603 123 456")
    expect(n.description).toContain(
      "Objednávka v administraci: https://admin.example.cz/app/orders/order_01ABC"
    )
    expect(n.description).toContain("Chtěla bych ještě jeden hrnek.")
    expect(n.replyTo).toBe("jana@example.cz")
    expect(n.key.startsWith("mn:order-change:order_01ABC:")).toBe(true)
  })

  it("stejná zpráva = stejný klíč (dvojklik), jiná zpráva = jiný", () => {
    const a = buildOrderChangeNotification(order, { phone: "603123456", message: "A" }, "")
    const b = buildOrderChangeNotification(order, { phone: "603123456", message: "A" }, "")
    const c = buildOrderChangeNotification(order, { phone: "603123456", message: "B" }, "")
    expect(a.key).toBe(b.key)
    expect(a.key).not.toBe(c.key)
  })

  it("bez adresy administrace a bez jména řádek vynechá, nic nevymýšlí", () => {
    const n = buildOrderChangeNotification(
      { id: "order_1", display_id: 7, email: null, customer_name: null },
      { phone: "603123456", message: "x" },
      ""
    )
    expect(n.description).not.toContain("administraci")
    expect(n.description).toContain("Od: zákazník")
    expect(n.replyTo).toBeUndefined()
  })
})

describe("adminOrderUrl / isDialablePhone", () => {
  it("skládá /app/orders/:id bez zdvojeného lomítka; bez základu prázdné", () => {
    expect(adminOrderUrl("order_1", "https://api.example.cz/")).toBe(
      "https://api.example.cz/app/orders/order_1"
    )
    expect(adminOrderUrl("order_1", "")).toBe("")
  })

  it("telefon musí mít aspoň pár číslic", () => {
    expect(isDialablePhone("+420 603 123 456")).toBe(true)
    expect(isDialablePhone("+420")).toBe(false)
    expect(isDialablePhone("abc")).toBe(false)
  })
})
