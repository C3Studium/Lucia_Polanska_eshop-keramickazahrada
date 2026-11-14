import { profilZObjednavky, pripojitObjednavkyHosta } from "../pripojit-objednavky-hosta"

const domov = {
  first_name: "Jana", last_name: "Nováková", address_1: "Testovací 12", city: "Písek",
  postal_code: "39701", country_code: "cz", phone: "+420777000111",
}
const balikovna = { first_name: "Jana", last_name: "Nováková", address_1: "Balíkovna Písek", city: "Písek", postal_code: "39701", country_code: "cz" }

describe("profilZObjednavky — co doplnit do prázdného profilu", () => {
  it("prázdný účet dostane jméno, telefon a adresu z nejnovější objednávky (fakturační první)", () => {
    const z = profilZObjednavky(
      { first_name: null, last_name: null, phone: null, addresses: [] },
      [{ created_at: "2026-11-14", billing_address: domov, shipping_address: balikovna }]
    )
    expect(z.zakaznik).toEqual({ first_name: "Jana", last_name: "Nováková", phone: "+420777000111" })
    expect(z.adresa?.address_1).toBe("Testovací 12")
  })
  it("vyplněné údaje nepřepisuje, adresu nepřidá, když nějakou má", () => {
    const z = profilZObjednavky(
      { first_name: "Jan", last_name: "N", phone: "+420111", addresses: [{ id: "a" }] },
      [{ created_at: "2026-11-14", billing_address: domov }]
    )
    expect(z.zakaznik).toEqual({})
    expect(z.adresa).toBeNull()
  })
  it("bez objednávek nic", () => {
    expect(profilZObjednavky({ addresses: [] }, [])).toEqual({ zakaznik: {}, adresa: null })
  })
})

describe("pripojitObjednavkyHosta — po potvrzení e-mailu", () => {
  it("objednávky hosta se stejným e-mailem přejdou na účet a profil se doplní", async () => {
    const updatesOrders: any[] = []
    const updatesCustomer: any[] = []
    const adresy: any[] = []
    const sluzby = {
      customers: {
        listCustomers: async (f: any) => (f.has_account === false ? [{ id: "cus_host" }] : []),
        retrieveCustomer: async () => ({ id: "cus_ucet", first_name: null, last_name: null, phone: null, addresses: [] }),
        updateCustomers: async (id: string, d: any) => updatesCustomer.push([id, d]),
        createCustomerAddresses: async (a: any) => adresy.push(a),
      },
      orders: {
        listOrders: async () => [
          { id: "order_2", created_at: "2026-11-14", billing_address: domov },
          { id: "order_1", created_at: "2026-10-01", billing_address: domov },
        ],
        updateOrders: async (id: string, d: any) => updatesOrders.push([id, d]),
      },
    }
    const vysledek = await pripojitObjednavkyHosta("cus_ucet", "Jana@Example.cz", sluzby as any)
    expect(vysledek.pripojeno).toBe(2)
    expect(updatesOrders).toEqual([
      ["order_2", { customer_id: "cus_ucet" }],
      ["order_1", { customer_id: "cus_ucet" }],
    ])
    expect(updatesCustomer[0][1].first_name).toBe("Jana")
    expect(adresy[0][0]).toMatchObject({ customer_id: "cus_ucet", address_1: "Testovací 12", is_default_shipping: true })
  })
  it("žádný host = nic", async () => {
    const sluzby = {
      customers: { listCustomers: async () => [], retrieveCustomer: async () => ({}), updateCustomers: async () => 0, createCustomerAddresses: async () => 0 },
      orders: { listOrders: async () => [], updateOrders: async () => 0 },
    }
    expect((await pripojitObjednavkyHosta("cus_ucet", "x@y.cz", sluzby as any)).pripojeno).toBe(0)
  })
})
