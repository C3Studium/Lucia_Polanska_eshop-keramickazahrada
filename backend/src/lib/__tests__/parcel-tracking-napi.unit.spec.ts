import { classifyByText, classifyState } from "../parcel-tracking/classify"
import { napiCredentials, parseNapiCurrentStatus } from "../parcel-tracking/napi"
import { planParcelUpdate } from "../parcel-tracking/plan"
import {
  fulfillmentItemsOf,
  shipmentItemsOf,
} from "../parcel-tracking/shipment-items"

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

  it("#36 (změřeno): položka bez quantity, množství jen na detail → 7 kusů k odeslání", () => {
    const order = {
      items: Array.from({ length: 7 }, (_, i) => ({
        id: `ordli_${i}`,
        requires_shipping: true,
        detail: {
          quantity: 1,
          raw_quantity: { value: "1", precision: 20 },
          shipped_quantity: 0,
          raw_shipped_quantity: { value: "0", precision: 20 },
        },
      })),
    }
    expect(shipmentItemsOf(order)).toHaveLength(7)
    expect(shipmentItemsOf(order)[0]).toEqual({ id: "ordli_0", quantity: 1 })
    expect(fulfillmentItemsOf({ items: [{ id: "x", requires_shipping: true, detail: { quantity: 2, fulfilled_quantity: 2 } }] })).toEqual([])
  })

  it("k vyskladnění počítá z fulfilled_quantity, i když je BigNumber", () => {
    const order = {
      items: [
        { id: "a", requires_shipping: true, quantity: { value: "2" }, detail: { fulfilled_quantity: { value: "2" }, shipped_quantity: { value: "0" } } },
        { id: "b", requires_shipping: true, quantity: { value: "2" }, detail: { fulfilled_quantity: { value: "1" }, shipped_quantity: { value: "0" } } },
      ],
    }
    expect(fulfillmentItemsOf(order)).toEqual([{ id: "b", quantity: 1 }])
    expect(shipmentItemsOf(order)).toEqual([
      { id: "a", quantity: 2 },
      { id: "b", quantity: 2 },
    ])
  })
})

describe("posloupnosti z nAPI (úložna, vrácení)", () => {
  const snapshot = (over = {}) => ({
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
    ...over,
  })
  const cis = (statusID, reasonID, name, date = "2026-10-09") =>
    parseNapiCurrentStatus({ parcelStatus: { statusID, reasonID, date, statusDescription: name } })

  it("ULOŽENO → ÚLOŽNA (nevyzvednuto) = problém s upozorněním, stored_at zůstává", () => {
    const stored = planParcelUpdate(snapshot(), cis("51", "20", "ULOŽENO"), "cp", NOW)
    expect(stored.patch.phase).toBe("stored")
    expect(stored.patch.stored_at).not.toBeNull()
    expect(stored.triggers.handed_over).toBe(true)

    const ulozna = planParcelUpdate(
      { ...stored.patch, created_at: NOW } as never,
      cis("99", "00", "ÚLOŽNA BALÍKOVNA", "2026-10-16"),
      "cp",
      new Date("2026-10-16T10:00:00.000Z")
    )
    expect(ulozna.patch.phase).toBe("problem")
    expect(ulozna.triggers.damaged).toBe(true)
    expect(ulozna.patch.stored_at).toEqual(stored.patch.stored_at)
    expect(ulozna.patch.done).toBe(false)
  })

  it("VRACÍ SE uzavře sledování jako vrácené a spustí upozornění", () => {
    const back = planParcelUpdate(
      snapshot({ phase: "problem", handed_over_at: NOW, stored_at: NOW }),
      cis("95", "00", "VRACÍ SE"),
      "cp",
      NOW
    )
    expect(back.patch.phase).toBe("returned")
    expect(back.patch.done).toBe(true)
    expect(back.triggers.returned).toBe(true)
    expect(back.triggers.handed_over).toBe(false)
  })

  it("DORUČENO po ULOŽENO = převzato, hotovo, bez dalšího upozornění", () => {
    const delivered = planParcelUpdate(
      snapshot({ phase: "stored", handed_over_at: NOW, stored_at: NOW }),
      cis("91", "00", "DORUČENO"),
      "cp",
      NOW
    )
    expect(delivered.patch.phase).toBe("delivered")
    expect(delivered.patch.delivered_at).not.toBeNull()
    expect(delivered.patch.done).toBe(true)
    expect(delivered.triggers).toEqual({ handed_over: false, returned: false, damaged: false, never_appeared: false })
  })

  it("PŘEDANÁ DATA 30 dnů bez podání = vzdáno s upozorněním", () => {
    const created = new Date("2026-09-01T10:00:00.000Z")
    const plan = planParcelUpdate(
      snapshot({ created_at: created }),
      cis("13", "00", "PŘEDANÁ DATA", "2026-09-01"),
      "cp",
      new Date("2026-10-09T10:00:00.000Z")
    )
    // „PŘEDANÁ DATA" je jen štítek — skutečná událost to není, takže po 30 dnech se vzdává.
    expect(plan.patch.phase).toBe("label")
    expect(plan.patch.done).toBe(true)
    expect(plan.triggers.never_appeared).toBe(true)
  })
})

describe("simulace ve tvaru nAPI", () => {
  it("každý simulovatelný stav se klasifikuje stejně jako jeho veřejná podoba", () => {
    const { SIMULATED_NAPI_EVENTS, SIMULATABLE_STATES } = require("../parcel-tracking/classify")
    const expected = { "21": "handed_over", "75": "in_transit", "82": "stored", "91": "delivered", "95": "returned", "8E": "problem" }
    for (const state of SIMULATABLE_STATES) {
      const shape = SIMULATED_NAPI_EVENTS[state]
      expect(classifyState(shape.id, `${shape.text} (simulace)`).kind).toBe(expected[state])
      expect(classifyState(state).kind).toBe(expected[state])
    }
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
