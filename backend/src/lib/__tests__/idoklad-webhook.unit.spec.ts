import {
  extractIdokladEvents,
  isInvoicePaidEvent,
  isIssuedInvoiceEntity,
  isPaidAction,
  publicIdMatches,
} from "../idoklad-webhook"

const PUBLIC_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

describe("publicIdMatches — the whole proof of origin", () => {
  it("accepts the registered PublicId, casing normalized (GUIDs)", () => {
    expect(publicIdMatches(PUBLIC_ID, PUBLIC_ID)).toBe(true)
    expect(publicIdMatches(PUBLIC_ID.toUpperCase(), PUBLIC_ID)).toBe(true)
    expect(publicIdMatches(`  ${PUBLIC_ID}  `, PUBLIC_ID)).toBe(true)
  })

  it("rejects a wrong, empty or missing PublicId", () => {
    expect(publicIdMatches("someone-elses-guid", PUBLIC_ID)).toBe(false)
    expect(publicIdMatches("", PUBLIC_ID)).toBe(false)
    expect(publicIdMatches(undefined, PUBLIC_ID)).toBe(false)
    expect(publicIdMatches(null, PUBLIC_ID)).toBe(false)
    expect(publicIdMatches(123 as unknown, PUBLIC_ID)).toBe(false)
  })

  it("never matches when nothing is configured — misconfiguration is closed, not open", () => {
    expect(publicIdMatches(PUBLIC_ID, "")).toBe(false)
    expect(publicIdMatches(PUBLIC_ID, undefined)).toBe(false)
  })
})

describe("extractIdokladEvents — tolerated delivery shapes", () => {
  const flatEvent = {
    PublicId: PUBLIC_ID,
    EntityType: 0,
    ActionType: 4,
    EntityId: 987654,
  }

  it("reads a single flat event object", () => {
    expect(extractIdokladEvents(flatEvent)).toEqual([
      { entity: 0, action: 4, entity_id: 987654, public_id: PUBLIC_ID },
    ])
  })

  it("reads an array of events", () => {
    const events = extractIdokladEvents([flatEvent, { ...flatEvent, EntityId: 5 }])
    expect(events).toHaveLength(2)
    expect(events[1].entity_id).toBe(5)
  })

  it("reads a wrapper and inherits its PublicId into the events", () => {
    const events = extractIdokladEvents({
      PublicId: PUBLIC_ID,
      Events: [{ EntityType: 0, ActionType: 4, EntityId: 11 }],
    })
    expect(events).toEqual([
      { entity: 0, action: 4, entity_id: 11, public_id: PUBLIC_ID },
    ])
  })

  it("keeps an event's own PublicId over the wrapper's", () => {
    const events = extractIdokladEvents({
      PublicId: "wrapper-id",
      Items: [{ EntityType: 0, ActionType: 4, EntityId: 11, PublicId: PUBLIC_ID }],
    })
    expect(events[0].public_id).toBe(PUBLIC_ID)
  })

  it("yields nothing for junk bodies", () => {
    expect(extractIdokladEvents(null)).toEqual([])
    expect(extractIdokladEvents("text")).toEqual([])
    expect(extractIdokladEvents(42)).toEqual([])
  })
})

describe("event filtering — EntityType 0 (IssuedInvoice) + ActionType 4 (Paid)", () => {
  it("recognizes the numeric enums and their textual names", () => {
    expect(isIssuedInvoiceEntity(0)).toBe(true)
    expect(isIssuedInvoiceEntity("0")).toBe(true)
    expect(isIssuedInvoiceEntity("IssuedInvoice")).toBe(true)
    expect(isIssuedInvoiceEntity(1)).toBe(false)
    expect(isIssuedInvoiceEntity("Contact")).toBe(false)

    expect(isPaidAction(4)).toBe(true)
    expect(isPaidAction("4")).toBe(true)
    expect(isPaidAction("Paid")).toBe(true)
    expect(isPaidAction("Pay")).toBe(true)
    expect(isPaidAction(1)).toBe(false)
    expect(isPaidAction("Update")).toBe(false)
    // "Unpaid" must never read as paid.
    expect(isPaidAction("Unpaid")).toBe(false)
  })

  it("accepts only complete invoice-paid events", () => {
    const paid = { entity: 0, action: 4, entity_id: 1, public_id: PUBLIC_ID }
    expect(isInvoicePaidEvent(paid)).toBe(true)
    // Unknown event classes are tolerated by being skipped, never handled.
    expect(isInvoicePaidEvent({ ...paid, action: 1 })).toBe(false)
    expect(isInvoicePaidEvent({ ...paid, entity: 2 })).toBe(false)
    expect(isInvoicePaidEvent({ ...paid, entity_id: null })).toBe(false)
  })
})
