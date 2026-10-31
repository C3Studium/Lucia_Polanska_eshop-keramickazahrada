import {
  printedVoucherLines,
  shippingForcesElectronic,
} from "../voucher-kind-shipping"
import { VOUCHER_LINE_KEYS } from "../voucher"

const voucherProduct = { metadata: { gift_voucher: true } }

const line = (kind: string | null, product: any = voucherProduct) => ({
  id: `li_${kind ?? "none"}`,
  product,
  metadata: kind ? { [VOUCHER_LINE_KEYS.kind]: kind } : {},
})

const pickup = { data: { service_code: "PICKUP", personal_pickup: true } }
const posta = { data: {}, name: "Česká Pošta" }

describe("printedVoucherLines", () => {
  it("najde jen vytištěné poukazy", () => {
    const cart = {
      items: [line("physical"), line("electronic"), line(null, { metadata: {} })],
    }
    expect(printedVoucherLines(cart).map((l: any) => l.id)).toEqual([
      "li_physical",
    ])
  })

  it("řádek bez poukazového produktu nepočítá, ani s tou vlajkou", () => {
    const cart = { items: [line("physical", { metadata: {} })] }
    expect(printedVoucherLines(cart)).toHaveLength(0)
  })

  it("prázdný košík nepadá", () => {
    expect(printedVoucherLines(null)).toEqual([])
    expect(printedVoucherLines({})).toEqual([])
  })
})

describe("shippingForcesElectronic", () => {
  it("osobní odběr podobu nemění", () => {
    expect(shippingForcesElectronic({ shipping_methods: [pickup] })).toBe(false)
  })

  it("jakákoli jiná doprava ji překlopí", () => {
    expect(shippingForcesElectronic({ shipping_methods: [posta] })).toBe(true)
  })

  it("nezvolená doprava se nechává být — zákazník se ještě rozhoduje", () => {
    expect(shippingForcesElectronic({ shipping_methods: [] })).toBe(false)
    expect(shippingForcesElectronic({})).toBe(false)
  })

  it("odběr vedle zásilky se bere jako odběr (jedna z metod ho nese)", () => {
    expect(shippingForcesElectronic({ shipping_methods: [posta, pickup] })).toBe(
      false
    )
  })
})
