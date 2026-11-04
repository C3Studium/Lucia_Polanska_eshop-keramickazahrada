import {
  nejcastejsiAkce,
  selhani,
  soucty,
  textDeniku,
  type ZaznamProvozu,
} from "../denik"
import { druhZCesty, normalizujCestu } from "../sber"

/**
 * Souhrn deníku a rozpoznávání cest. Obojí rozhoduje o tom, co se v denním
 * e-mailu objeví — a chybu v tom pozná člověk až po dni, kdy mu zpráva
 * neřekne to, co potřeboval.
 */

const zaznam = (
  kind: string,
  action: string,
  status: "ok" | "chyba" = "ok",
  zbytek: Partial<ZaznamProvozu> = {}
): ZaznamProvozu => ({ kind, action, status, ...zbytek })

describe("souhrn deníku", () => {
  it("počítá po druzích a odděluje selhání od proběhlého", () => {
    const vysledek = soucty([
      zaznam("platba", "payment.captured"),
      zaznam("platba", "payment.captured"),
      zaznam("platba", "POST /hooks/payment", "chyba"),
      zaznam("email", "POST /admin/newsletter/test"),
    ])

    const platby = vysledek.find((s) => s.druh === "platba")
    expect(platby).toMatchObject({ nazev: "Platby", ok: 2, chyby: 1 })
    expect(vysledek.find((s) => s.druh === "email")).toMatchObject({
      nazev: "E-maily",
      ok: 1,
      chyby: 0,
    })
  })

  it("řadí peníze nahoru a techniku dolů", () => {
    const poradi = soucty([
      zaznam("uloha", "job:watch-provoz"),
      zaznam("admin", "PUT /admin/products/:id"),
      zaznam("platba", "payment.captured"),
    ]).map((s) => s.druh)

    expect(poradi).toEqual(["platba", "admin", "uloha"])
  })

  it("neznámý druh se neztratí, jen jde na konec", () => {
    const vysledek = soucty([
      zaznam("platba", "payment.captured"),
      zaznam("neznamy-druh", "cosi"),
    ])
    expect(vysledek.map((s) => s.druh)).toEqual(["platba", "neznamy-druh"])
    expect(vysledek[1].nazev).toBe("neznamy-druh")
  })

  it("prázdný den se nevydává za v pořádku", () => {
    const text = textDeniku([])
    expect(text).toContain("ani jedna akce")
    expect(text).toContain("Provozní deník")
  })

  it("nejčastější akce ukáže, z čeho se počet skládá", () => {
    const zaznamy = [
      zaznam("admin", "PUT /admin/products/:id"),
      zaznam("admin", "PUT /admin/products/:id"),
      zaznam("admin", "POST /admin/dokumenty"),
    ]
    expect(nejcastejsiAkce(zaznamy, "admin")).toEqual([
      "PUT /admin/products/:id (2×)",
      "POST /admin/dokumenty (1×)",
    ])
  })

  it("selhání nese důvod a identifikátor, ne jen název", () => {
    const radky = selhani([
      zaznam("platba", "POST /hooks/payment", "chyba", {
        ref_type: "order",
        ref_id: "order_123",
        detail: { chyba: "ComGate vrátil 500" },
      }),
    ])

    expect(radky).toHaveLength(1)
    expect(radky[0]).toContain("order_123")
    expect(radky[0]).toContain("ComGate vrátil 500")
  })

  /*
   * Sběr z HTTP píše tutéž větu dvakrát — do `detail.chyba` i do `summary`
   * (sber.ts). V souhrnu z 3. 11. 2026 z toho bylo „odpověď 400 · odpověď
   * 400", což vypadá jako dvě různé chyby.
   */
  it("shodný důvod a popis vypíše jednou", () => {
    const [radek] = selhani([
      zaznam("reklamace", "POST /admin/return-requests/:id/refund-account", "chyba", {
        summary: "odpověď 400",
        detail: { chyba: "odpověď 400" },
      }),
    ])

    expect(radek).toContain("odpověď 400")
    expect(radek.split("odpověď 400")).toHaveLength(2)
  })

  it("jiný popis než důvod se nezahodí", () => {
    const [radek] = selhani([
      zaznam("platba", "POST /hooks/payment", "chyba", {
        summary: "objednávka #42",
        detail: { chyba: "odpověď 500" },
      }),
    ])

    expect(radek).toContain("odpověď 500")
    expect(radek).toContain("objednávka #42")
  })
})

describe("rozpoznání cesty", () => {
  it("identifikátory nahradí za :id, aby se dalo počítat", () => {
    expect(normalizujCestu("/admin/products/prod_01JABCDEF12345")).toBe(
      "/admin/products/:id"
    )
    expect(normalizujCestu("/admin/orders/order_01JXYZ9876543/edit")).toBe(
      "/admin/orders/:id/edit"
    )
    expect(normalizujCestu("/store/orders/42")).toBe("/store/orders/:id")
  })

  it("běžná slova v cestě zůstanou", () => {
    expect(normalizujCestu("/admin/made-to-order/shipping-options")).toBe(
      "/admin/made-to-order/shipping-options"
    )
  })

  it("druh pozná podle cesty, konkrétnější pravidlo vyhrává", () => {
    expect(druhZCesty("/store/orders/order_1/claims")).toBe("reklamace")
    expect(druhZCesty("/admin/gift-vouchers")).toBe("poukaz")
    expect(druhZCesty("/admin/made-to-order/orders/order_1")).toBe("zakazka")
    expect(druhZCesty("/hooks/payment/comgate")).toBe("platba")
    expect(druhZCesty("/hooks/idoklad")).toBe("faktura")
    expect(druhZCesty("/admin/products")).toBe("admin")
    expect(druhZCesty("/store/carts/cart_1")).toBe("obchod")
  })
})
