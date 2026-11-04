import { cekaNaOdeslani } from "../kontroly"

/**
 * Pravidlo „leží to bez odeslání" — to jediné z kontrol, co jde zkusit bez
 * containeru, a zároveň to, co 3. 11. 2026 zaplavilo souhrn: hlídka nahlásila
 * 35 objednávek, z toho většinu osobních odběrů, které se nikdy neodesílají.
 * Mezi nimi se ztratily dvě zásilky, které opravdu ležely.
 */
const ZAPLACENO = [{ captured_amount: 1390 }]

const zasilka = (data: Record<string, unknown> = { service_code: "DR" }) => [
  { name: "Česká Pošta - Křehké", data },
]

const odber = () => [
  {
    name: "Osobní odběr",
    data: { service_code: "PICKUP", personal_pickup: true },
  },
]

describe("čeká na odeslání", () => {
  it("zaplacená zásilka bez podání se hlásí", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: ZAPLACENO,
        shipping_methods: zasilka(),
        fulfillment_status: "not_fulfilled",
      })
    ).toBe(true)
  })

  it("osobní odběr se nehlásí — nikdo ho neposílá", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: ZAPLACENO,
        shipping_methods: odber(),
        fulfillment_status: "not_fulfilled",
      })
    ).toBe(false)
  })

  /*
   * Zakázka s cenou po domluvě vzniká na odběr a dopravu dostane až
   * v administraci; Medusa data metody SLUČUJE, takže po výměně může
   * zůstat `personal_pickup: true` vedle kódu dopravce. Kód služby
   * rozhoduje (lib/personal-pickup) — tahle objednávka se odesílá.
   */
  it("vyměněná doprava se hlásí, i když po odběru zbyl příznak", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: ZAPLACENO,
        shipping_methods: zasilka({ service_code: "DR", personal_pickup: true }),
        fulfillment_status: "not_fulfilled",
      })
    ).toBe(true)
  })

  it("objednávka bez dopravy se nehlásí — elektronický poukaz se neposílá", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: ZAPLACENO,
        shipping_methods: [],
        fulfillment_status: "not_fulfilled",
      })
    ).toBe(false)
  })

  it("nezaplacené a zrušené si řeší jiné kontroly", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: [{ captured_amount: 0 }],
        shipping_methods: zasilka(),
        fulfillment_status: "not_fulfilled",
      })
    ).toBe(false)

    expect(
      cekaNaOdeslani({
        status: "canceled",
        payment_collections: ZAPLACENO,
        shipping_methods: zasilka(),
        fulfillment_status: "not_fulfilled",
      })
    ).toBe(false)
  })

  it("podaná zásilka se nehlásí", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: ZAPLACENO,
        shipping_methods: zasilka(),
        fulfillment_status: "fulfilled",
      })
    ).toBe(false)
  })

  /* Chybějící `fulfillment_status` znamená „nic nepodáno", ne „nevím". */
  it("bez stavu podání platí, že podáno nebylo", () => {
    expect(
      cekaNaOdeslani({
        payment_collections: ZAPLACENO,
        shipping_methods: zasilka(),
      })
    ).toBe(true)
  })
})
