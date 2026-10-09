import { classifyByText, classifyState } from "../parcel-tracking/classify"
import { napiCredentials, parseNapiCurrentStatus } from "../parcel-tracking/napi"
import { planParcelUpdate } from "../parcel-tracking/plan"
import { shipmentItemsOf } from "../parcel-tracking/shipment-items"

/**
 * nAPI ČP (B2B) jako zdroj sledování: názvy z oficiálního číselníku → fáze,
 * parser `parcelStatuses/current` (tvar ověřený živě 9. 10. 2026).
 */

const NOW = new Date("2026-10-09T15:00:00.000Z")

describe("názvy stavů z číselníku CIS → význam", () => {
  it.each([
    ["ZPRACOVANÁ DATA", "label"],
    ["PŘEDANÁ DATA", "label"],
    ["PODÁNO", "handed_over"],
    ["V PŘEPRAVĚ", "in_transit"],
    ["ULOŽENO", "stored"],
    ["ULOŽENO!", "stored"],
    ["DORUČENO", "delivered"],
    ["VRACÍ SE", "returned"],
    ["VRÁCENO ODESILATELI", "returned"],
    ["POŠTOVNÍ ÚLOŽNA", "problem"],
    ["ÚLOŽNA BALÍKOVNA", "problem"],
  ])("%s → %s", (name, kind) => {
    expect(classifyByText(name)).toBe(kind)
  })

  it("u `cis:` id rozhoduje název, ne číslo (51 je V PŘEPRAVĚ i ULOŽENO)", () => {
    expect(classifyState("cis:51/00", "V PŘEPRAVĚ").kind).toBe("in_transit")
    expect(classifyState("cis:51/20", "ULOŽENO").kind).toBe("stored")
    expect(classifyState("cis:88/00", "DORUČENO").kind).toBe("delivered")
    expect(classifyState("cis:88/01", "VRÁCENO ODESILATELI").kind).toBe("returned")
  })
})

describe("parser parcelStatuses/current", () => {
  it("převede aktuální stav na jednu událost s názvem a poštou", () => {
    const events = parseNapiCurrentStatus({
      idParcel: "NB1249245895U",
      parcelStatus: {
        statusID: "13",
        reasonID: "00",
        date: "2026-10-09",
        datetime: "2026-10-09T16:48:56.01+02:00",
        statusDescription: "PŘEDANÁ DATA",
        postOffice: "10003",
        postOfficeName: "Depo Praha 701",
      },
    })
    expect(events).toEqual([
      {
        id: "cis:13/00",
        text: "PŘEDANÁ DATA",
        date: "2026-10-09",
        postoffice: "10003 Depo Praha 701",
        postcode: "10003",
      },
    ])
    expect(classifyState(events[0].id, events[0].text).kind).toBe("label")
  })

  it("bez parcelStatus = ČP zásilku nezná (počítá se, neukládá)", () => {
    const events = parseNapiCurrentStatus({ idParcel: "X" })
    expect(events[0].id).toBe("-3")
    const plan = planParcelUpdate(
      {
        phase: "label",
        events: [],
        handed_over_at: null,
        stored_at: null,
        delivered_at: null,
        returned_at: null,
        done: false,
        note: null,
        check_count: 0,
        created_at: NOW,
      },
      events,
      "cp",
      NOW
    )
    expect(plan.newEvents).toHaveLength(0)
    expect(plan.patch.check_count).toBe(1)
  })

  it("změna důvodu u téhož čísla stavu je nová událost, opakování ne", () => {
    const first = parseNapiCurrentStatus({
      parcelStatus: { statusID: "44", reasonID: "01", date: "2026-10-09", statusDescription: "V PŘEPRAVĚ" },
    })
    const base = planParcelUpdate(
      {
        phase: "label",
        events: [],
        handed_over_at: null,
        stored_at: null,
        delivered_at: null,
        returned_at: null,
        done: false,
        note: null,
        check_count: 0,
        created_at: NOW,
      },
      first,
      "cp",
      NOW
    )
    // Na cestě bez výslovného „podáno" = dopravce ji má → předání.
    expect(base.triggers.handed_over).toBe(true)
    expect(base.patch.phase).toBe("in_transit")

    const again = planParcelUpdate(
      { ...base.patch, created_at: NOW } as never,
      first,
      "cp",
      NOW
    )
    expect(again.newEvents).toHaveLength(0)

    const reason = planParcelUpdate(
      { ...base.patch, created_at: NOW } as never,
      parseNapiCurrentStatus({
        parcelStatus: { statusID: "44", reasonID: "05", date: "2026-10-09", statusDescription: "V PŘEPRAVĚ" },
      }),
      "cp",
      NOW
    )
    expect(reason.newEvents).toHaveLength(1)
    expect(reason.triggers.handed_over).toBe(false)
  })
})

describe("položky k odeslání (BigNumber z query.graph)", () => {
  it("čísla, řetězce i objekty {value} dají totéž", () => {
    const order = {
      items: [
        { id: "a", requires_shipping: true, quantity: 1, detail: { shipped_quantity: 0 } },
        { id: "b", requires_shipping: true, quantity: { value: "2", precision: 20 }, detail: { shipped_quantity: { value: "1" } } },
        { id: "c", requires_shipping: true, quantity: "3", detail: { shipped_quantity: "3" } },
        { id: "d", requires_shipping: false, quantity: 5, detail: { shipped_quantity: 0 } },
        { id: "e", requires_shipping: true, raw_quantity: { value: "4" }, detail: { raw_shipped_quantity: { value: "1" } } },
      ],
    }
    expect(shipmentItemsOf(order)).toEqual([
      { id: "a", quantity: 1 },
      { id: "b", quantity: 1 },
      { id: "e", quantity: 3 },
    ])
  })

  it("objednávka #36 (9. 10. 2026): sedm kusů jako objekty → sedm položek, ne nula", () => {
    const order = {
      items: Array.from({ length: 7 }, (_, i) => ({
        id: `ordli_${i}`,
        requires_shipping: true,
        quantity: { value: "1", precision: 20 },
        detail: { shipped_quantity: { value: "0", precision: 20 } },
      })),
    }
    expect(shipmentItemsOf(order)).toHaveLength(7)
  })
})

describe("přístupy k nAPI", () => {
  it("jen se všemi třemi hodnotami", () => {
    expect(napiCredentials({})).toBeNull()
    expect(napiCredentials({ BALIKOVNA_API_URL: "https://x", BALIKOVNA_API_TOKEN: "t" })).toBeNull()
    expect(
      napiCredentials({
        BALIKOVNA_API_URL: "https://x/ZSKService/v1/",
        BALIKOVNA_API_TOKEN: "t",
        BALIKOVNA_API_SECRET: "s",
      })
    ).toEqual({ apiUrl: "https://x/ZSKService/v1/", apiToken: "t", apiSecret: "s" })
  })
})
