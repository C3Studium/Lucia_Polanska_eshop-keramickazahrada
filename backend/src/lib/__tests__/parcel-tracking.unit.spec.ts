import {
  cpCarrierName,
  cpTrackingUrl,
  isSimulateAllowed,
} from "../parcel-tracking/carrier"
import {
  classifyByText,
  classifyState,
  CP_STATE_TEXTS,
  isSimulatableState,
  SIMULATABLE_STATES,
} from "../parcel-tracking/classify"
import { parseParcelHistory } from "../parcel-tracking/client"
import {
  eventKey,
  eventTimestamp,
  nextPhase,
  planParcelUpdate,
  type TrackingSnapshot,
} from "../parcel-tracking/plan"

/**
 * Sledování zásilek ČP — čistá logika (docs/sledovani-zasilek.md §1, §3).
 *
 * Testuje se číselník → fáze, textový fallback, parser odpovědi a hlavně
 * plánovač přechodů: razítka jen jednou, fáze jen vpřed, dedupe, vzdání po
 * 30 dnech. Job i simulace jdou touž cestou, takže co platí tady, platí pro obě.
 */

const NOW = new Date("2026-10-09T10:00:00.000Z")
const TODAY = "2026-10-09"

const fresh = (overrides: Partial<TrackingSnapshot> = {}): TrackingSnapshot => ({
  phase: "label",
  events: [],
  handed_over_at: null,
  stored_at: null,
  delivered_at: null,
  returned_at: null,
  done: false,
  note: null,
  check_count: 0,
  created_at: new Date("2026-10-08T08:00:00.000Z"),
  ...overrides,
})

const ev = (id: string, date = TODAY, text = CP_STATE_TEXTS[id] ?? id) => ({
  id,
  text,
  date,
})

describe("číselník stavů ČP → fáze", () => {
  it("mapuje známá id podle tabulky z kontraktu", () => {
    expect(classifyState("-M").kind).toBe("label")
    expect(classifyState("21").kind).toBe("handed_over")
    for (const id of ["75", "51", "8D", "8T"]) {
      expect(classifyState(id).kind).toBe("in_transit")
    }
    expect(classifyState("8T").misrouted).toBe(true)
    expect(classifyState("82").kind).toBe("stored")
    expect(classifyState("91").kind).toBe("delivered")
    expect(classifyState("95").kind).toBe("returned")
    expect(classifyState("9V").kind).toBe("returned")
    expect(classifyState("8E").kind).toBe("problem")
    expect(classifyState("88").kind).toBe("out_of_register")
    expect(classifyState("-3").kind).toBe("not_found")
    expect(classifyState("-4").kind).toBe("not_found")
  })

  it("neznámé id klasifikuje podle textu, vrácení vítězí nad doručením", () => {
    expect(classifyState("ZZ", "Zásilka podána na poště").kind).toBe("handed_over")
    expect(classifyState("ZZ", "Převzata k přepravě").kind).toBe("handed_over")
    expect(classifyState("ZZ", "Doručena adresátovi").kind).toBe("delivered")
    expect(classifyState("ZZ", "Dodána").kind).toBe("delivered")
    expect(classifyState("ZZ", "Uložena na poště").kind).toBe("stored")
    expect(classifyState("ZZ", "Vrácena odesílateli").kind).toBe("returned")
    // „Doručená odesílateli" = vrácení, ne doručení zákazníkovi.
    expect(classifyByText("Doručená odesílateli")).toBe("returned")
    expect(classifyState("ZZ", "Něco úplně jiného").kind).toBe("in_transit")
    expect(classifyState("ZZ", "Něco").known).toBe(false)
  })

  it("simulovat jde jen šest stavů z kontraktu", () => {
    expect([...SIMULATABLE_STATES]).toEqual(["21", "75", "82", "91", "95", "8E"])
    expect(isSimulatableState("21")).toBe(true)
    expect(isSimulatableState("88")).toBe(false)
    expect(isSimulatableState(21)).toBe(false)
    for (const state of SIMULATABLE_STATES) {
      expect(CP_STATE_TEXTS[state]).toBeTruthy()
    }
  })
})

describe("parser odpovědi ČP", () => {
  it("čte živý tvar odpovědi (pole zásilek, states.state[])", () => {
    const payload = [
      {
        id: "DR0000000000X",
        attributes: { parcelType: "" },
        states: {
          state: [
            {
              id: "-3",
              date: "2026-10-09",
              text: "Zásilka tohoto podacího čísla není v evidenci.",
              postcode: null,
              postoffice: null,
            },
          ],
        },
      },
    ]
    expect(parseParcelHistory(payload)).toEqual([
      {
        id: "-3",
        text: "Zásilka tohoto podacího čísla není v evidenci.",
        date: "2026-10-09",
        postoffice: null,
        postcode: null,
      },
    ])
  })

  it("snese objekt místo pole a chybějící pole", () => {
    const single = {
      states: { state: { id: "21", date: "2026-10-08", text: "Podaná zásilka", postoffice: "Písek 1", postcode: "39701" } },
    }
    expect(parseParcelHistory(single)).toEqual([
      { id: "21", text: "Podaná zásilka", date: "2026-10-08", postoffice: "Písek 1", postcode: "39701" },
    ])
    expect(parseParcelHistory(null)).toEqual([])
    expect(parseParcelHistory([{ states: null }])).toEqual([])
    expect(parseParcelHistory([{ states: { state: [null, "x", {}] } }])).toEqual([])
  })
})

describe("plánovač — první podání (21)", () => {
  it("nastaví handed_over_at, fázi a spustí předání dopravci", () => {
    const plan = planParcelUpdate(fresh(), [ev("-M", "2026-10-08"), ev("21")], "cp", NOW)

    expect(plan.patch.phase).toBe("handed_over")
    expect(plan.patch.handed_over_at).toEqual(NOW)
    expect(plan.triggers.handed_over).toBe(true)
    expect(plan.newEvents).toHaveLength(2)
    expect(plan.newEvents[1]).toMatchObject({ id: "21", source: "cp", seen_at: NOW.toISOString() })
    expect(plan.patch.last_state_id).toBe("21")
    expect(plan.patch.last_state_text).toBe("Podaná zásilka")
    expect(plan.patch.check_count).toBe(1)
    expect(plan.patch.done).toBe(false)
  })

  it("je idempotentní — stejné události podruhé nic nezmění a nic nespustí", () => {
    const first = planParcelUpdate(fresh(), [ev("-M", "2026-10-08"), ev("21")], "cp", NOW)
    const again = planParcelUpdate(
      fresh({ ...first.patch, created_at: fresh().created_at }),
      [ev("-M", "2026-10-08"), ev("21")],
      "cp",
      new Date(NOW.getTime() + 30 * 60 * 1000)
    )

    expect(again.newEvents).toHaveLength(0)
    expect(again.triggers.handed_over).toBe(false)
    expect(again.patch.handed_over_at).toEqual(first.patch.handed_over_at)
    expect(again.patch.phase).toBe("handed_over")
    expect(again.patch.events).toHaveLength(2)
    expect(again.patch.check_count).toBe(2)
  })

  it("simulace jde touž cestou, jen nepočítá dotaz na ČP", () => {
    const plan = planParcelUpdate(
      fresh(),
      [{ id: "21", text: "Podaná zásilka (simulace)", date: TODAY }],
      "simulated",
      NOW
    )
    expect(plan.triggers.handed_over).toBe(true)
    expect(plan.patch.phase).toBe("handed_over")
    expect(plan.newEvents[0].source).toBe("simulated")
    expect(plan.patch.check_count).toBe(0)
  })

  it("stav na cestě bez předchozího 21 předání doplní (dopravce balík má)", () => {
    const plan = planParcelUpdate(fresh(), [ev("75", "2026-10-08")], "cp", NOW)
    expect(plan.triggers.handed_over).toBe(true)
    expect(plan.patch.handed_over_at).toEqual(new Date("2026-10-08T12:00:00.000Z"))
    expect(plan.patch.phase).toBe("in_transit")
  })
})

describe("plánovač — průběh a konce", () => {
  const handedOver = () =>
    fresh({
      phase: "handed_over",
      handed_over_at: new Date("2026-10-07T12:00:00.000Z"),
      events: [{ id: "21", text: "Podaná zásilka", date: "2026-10-07", source: "cp", seen_at: "x" }],
    })

  it("75/51 → in_transit bez spouštěčů; 82 → stored s razítkem", () => {
    const transit = planParcelUpdate(handedOver(), [ev("21", "2026-10-07"), ev("75", "2026-10-08")], "cp", NOW)
    expect(transit.patch.phase).toBe("in_transit")
    expect(transit.triggers).toEqual({ handed_over: false, returned: false, damaged: false, never_appeared: false })

    const stored = planParcelUpdate(
      handedOver(),
      [ev("21", "2026-10-07"), ev("75", "2026-10-08"), ev("51", "2026-10-08"), ev("82")],
      "cp",
      NOW
    )
    expect(stored.patch.phase).toBe("stored")
    expect(stored.patch.stored_at).toEqual(NOW)
    expect(stored.patch.done).toBe(false)
  })

  it("91 → delivered, done, bez e-mailu (žádný spouštěč)", () => {
    const plan = planParcelUpdate(handedOver(), [ev("21", "2026-10-07"), ev("82", "2026-10-08"), ev("91")], "cp", NOW)
    expect(plan.patch.phase).toBe("delivered")
    expect(plan.patch.delivered_at).toEqual(NOW)
    expect(plan.patch.stored_at).toEqual(new Date("2026-10-08T12:00:00.000Z"))
    expect(plan.patch.done).toBe(true)
    expect(plan.triggers.returned).toBe(false)
    expect(plan.triggers.damaged).toBe(false)
  })

  it("95 / 9V → returned, done, upozornit majitelku (jen jednou)", () => {
    const plan = planParcelUpdate(handedOver(), [ev("21", "2026-10-07"), ev("95")], "cp", NOW)
    expect(plan.patch.phase).toBe("returned")
    expect(plan.patch.returned_at).toEqual(NOW)
    expect(plan.patch.done).toBe(true)
    expect(plan.triggers.returned).toBe(true)

    const again = planParcelUpdate(
      fresh({ ...plan.patch, created_at: fresh().created_at }),
      [ev("21", "2026-10-07"), ev("95"), ev("9V")],
      "cp",
      NOW
    )
    expect(again.triggers.returned).toBe(false)
    expect(again.patch.returned_at).toEqual(plan.patch.returned_at)
  })

  it("8E → problem s upozorněním; další postup problem přepíše, zpět se nejde", () => {
    const damaged = planParcelUpdate(handedOver(), [ev("21", "2026-10-07"), ev("75", "2026-10-08"), ev("8E")], "cp", NOW)
    expect(damaged.patch.phase).toBe("problem")
    expect(damaged.triggers.damaged).toBe(true)
    expect(damaged.patch.done).toBe(false)

    // Po poškození „přepravovaná" fázi nevrací na in_transit…
    const later = planParcelUpdate(
      fresh({ ...damaged.patch, created_at: fresh().created_at }),
      [ev("21", "2026-10-07"), ev("75", "2026-10-08"), ev("8E"), ev("75", "2026-10-10")],
      "cp",
      NOW
    )
    expect(later.patch.phase).toBe("problem")
    expect(later.triggers.damaged).toBe(false)

    // …ale uložení/doručení ano.
    const delivered = planParcelUpdate(
      fresh({ ...later.patch, created_at: fresh().created_at }),
      [ev("21", "2026-10-07"), ev("75", "2026-10-08"), ev("8E"), ev("75", "2026-10-10"), ev("91", "2026-10-11")],
      "cp",
      NOW
    )
    expect(delivered.patch.phase).toBe("delivered")

    // Poškození u hotové zásilky fázi nemění.
    expect(nextPhase("delivered", "problem")).toBe("delivered")
    expect(nextPhase("returned", "problem")).toBe("returned")
  })

  it("88 → done bez změny fáze", () => {
    const plan = planParcelUpdate(handedOver(), [ev("21", "2026-10-07"), ev("88")], "cp", NOW)
    expect(plan.patch.phase).toBe("handed_over")
    expect(plan.patch.done).toBe(true)
  })

  it("8T si zapíše poznámku, fáze in_transit", () => {
    const plan = planParcelUpdate(handedOver(), [ev("21", "2026-10-07"), ev("8T")], "cp", NOW)
    expect(plan.patch.phase).toBe("in_transit")
    expect(plan.patch.note).toContain("chybně směrovaná")
  })

  it("fáze jde jen vpřed — pozdní 21 nevrátí uloženou zásilku", () => {
    expect(nextPhase("stored", "handed_over")).toBe("stored")
    expect(nextPhase("stored", "in_transit")).toBe("stored")
    expect(nextPhase("in_transit", "label")).toBe("in_transit")
    expect(nextPhase("label", "in_transit")).toBe("in_transit")
    expect(nextPhase("handed_over", "in_transit")).toBe("in_transit")
    expect(nextPhase("in_transit", "stored")).toBe("stored")
    expect(nextPhase("delivered", "returned")).toBe("delivered")
  })
})

describe("plánovač — není v evidenci (-3/-4)", () => {
  it("-3 nic nezapíše do historie, jen počítá a drží poslední stav", () => {
    const plan = planParcelUpdate(fresh(), [ev("-3")], "cp", NOW)
    expect(plan.newEvents).toHaveLength(0)
    expect(plan.patch.events).toHaveLength(0)
    expect(plan.patch.phase).toBe("label")
    expect(plan.patch.check_count).toBe(1)
    expect(plan.patch.done).toBe(false)
    expect(plan.patch.last_state_id).toBe("-3")
    expect(plan.triggers.never_appeared).toBe(false)
  })

  it("po 30 dnech od štítku bez události se vzdá a upozorní", () => {
    const old = fresh({ created_at: new Date("2026-09-01T08:00:00.000Z"), check_count: 1400 })
    const plan = planParcelUpdate(old, [ev("-3")], "cp", NOW)
    expect(plan.patch.done).toBe(true)
    expect(plan.triggers.never_appeared).toBe(true)
    expect(plan.patch.note).toContain("vzdáno po 30 dnech")
  })

  it("nevzdá se, když už nějaká skutečná událost přišla, ani při simulaci", () => {
    const old = fresh({ created_at: new Date("2026-09-01T08:00:00.000Z") })
    expect(planParcelUpdate(old, [ev("21", "2026-09-02")], "cp", NOW).triggers.never_appeared).toBe(false)
    expect(planParcelUpdate(old, [], "simulated", NOW).triggers.never_appeared).toBe(false)
  })

  it("prázdná odpověď nesmaže poslední známý stav", () => {
    const plan = planParcelUpdate(
      fresh({ last_state_id: "21", last_state_text: "Podaná zásilka" }),
      [],
      "cp",
      NOW
    )
    expect(plan.patch.last_state_id).toBe("21")
    expect(plan.patch.last_state_text).toBe("Podaná zásilka")
  })
})

describe("drobnosti", () => {
  it("dedupe klíč = id + datum + text", () => {
    expect(eventKey({ id: "21", date: "2026-10-09", text: "Podaná zásilka" })).toBe(
      "21|2026-10-09|Podaná zásilka"
    )
    expect(eventKey({})).toBe("||")
  })

  it("časové razítko: dnes = teď, jindy poledne UTC toho dne, nesmysl = teď", () => {
    expect(eventTimestamp(TODAY, NOW)).toEqual(NOW)
    expect(eventTimestamp("2026-10-01", NOW)).toEqual(new Date("2026-10-01T12:00:00.000Z"))
    expect(eventTimestamp("", NOW)).toEqual(NOW)
    expect(eventTimestamp("nic", NOW)).toEqual(NOW)
  })

  it("odkaz na sledování a název dopravce", () => {
    expect(cpTrackingUrl("DR1234567890X")).toBe(
      "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=DR1234567890X"
    )
    expect(cpTrackingUrl("")).toBe("")
    expect(cpTrackingUrl(null)).toBe("")
    expect(cpCarrierName("NB", "Balíkovna")).toBe("Česká pošta – Balíkovna")
    expect(cpCarrierName("DR", "x")).toBe("Česká pošta")
    expect(cpCarrierName("nb")).toBe("Česká pošta – Balíkovna")
    expect(cpCarrierName(null, "Zásilkovna")).toBe("Zásilkovna")
    expect(cpCarrierName(undefined)).toBe("")
  })

  it("simulace je povolená jen výslovně, nebo proti testovací ČP", () => {
    expect(isSimulateAllowed({})).toBe(false)
    expect(isSimulateAllowed({ CP_TRACKING_SIMULATE: "1" })).toBe(true)
    expect(isSimulateAllowed({ CP_TRACKING_SIMULATE: "true" })).toBe(false)
    expect(isSimulateAllowed({ BALIKOVNA_API_URL: "https://b2b-test.postaonline.cz/restservices/ZSKService/v1" })).toBe(true)
    expect(isSimulateAllowed({ BALIKOVNA_API_URL: "https://b2b.postaonline.cz/restservices/ZSKService/v1" })).toBe(false)
  })
})
