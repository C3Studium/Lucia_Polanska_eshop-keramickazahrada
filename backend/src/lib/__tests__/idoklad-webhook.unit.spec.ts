import { createHmac } from "crypto"
import {
  extractIdokladDelivery,
  invoicePaymentVerdict,
  isInvoicePaymentEvent,
  isIssuedInvoiceEntity,
  isPaymentCreatedAction,
  signIdokladPayload,
  verifyIdokladSignature,
} from "../idoklad-webhook"

const SECRET = "test_secret"

/** Přesně dokumentovaný tvar doručení (api.idoklad.cz/Help/v3, „Webhooky"). */
const documented = {
  DeliveryId: "106562fa-578b-41ec-8915-ac53806dfe46",
  Events: [
    {
      AgendaId: 0,
      EntityId: 987654,
      EntityType: "IssuedInvoice",
      EventDate: "2023-10-01T00:00:00Z",
      EventType: "PaymentCreated",
    },
  ],
}

describe("verifyIdokladSignature — X-idoklad-signature: sha256=<HEX>", () => {
  const payload = JSON.stringify(documented, null, 2)

  it("accepts HMAC-SHA256(UTF-8 secret, raw body) as hex, either case", () => {
    const hex = createHmac("sha256", SECRET).update(payload, "utf8").digest("hex")
    expect(verifyIdokladSignature({ secret: SECRET, header: `sha256=${hex.toUpperCase()}`, payload })).toBe(true)
    expect(verifyIdokladSignature({ secret: SECRET, header: `sha256=${hex}`, payload })).toBe(true)
    expect(verifyIdokladSignature({ secret: SECRET, header: [`sha256=${hex}`], payload: Buffer.from(payload) })).toBe(true)
  })

  it("matches what signIdokladPayload produces (the test-delivery path)", () => {
    expect(
      verifyIdokladSignature({ secret: SECRET, header: signIdokladPayload(SECRET, payload), payload })
    ).toBe(true)
  })

  it("is bound to the exact bytes — re-serialized JSON does not verify", () => {
    const header = signIdokladPayload(SECRET, payload)
    expect(
      verifyIdokladSignature({ secret: SECRET, header, payload: JSON.stringify(documented) })
    ).toBe(false)
  })

  it("rejects a wrong secret, a malformed header, a missing header", () => {
    const header = signIdokladPayload(SECRET, payload)
    expect(verifyIdokladSignature({ secret: "other", header, payload })).toBe(false)
    expect(verifyIdokladSignature({ secret: SECRET, header: header.replace("sha256=", ""), payload })).toBe(false)
    expect(verifyIdokladSignature({ secret: SECRET, header: "sha256=abc", payload })).toBe(false)
    expect(verifyIdokladSignature({ secret: SECRET, header: undefined, payload })).toBe(false)
  })

  it("never verifies without a configured secret — misconfiguration is closed", () => {
    const header = signIdokladPayload("", payload)
    expect(verifyIdokladSignature({ secret: "", header, payload })).toBe(false)
    expect(verifyIdokladSignature({ secret: undefined, header, payload })).toBe(false)
  })
})

describe("extractIdokladDelivery — the documented envelope", () => {
  it("reads DeliveryId and Events[] with textual enums", () => {
    expect(extractIdokladDelivery(documented)).toEqual({
      delivery_id: "106562fa-578b-41ec-8915-ac53806dfe46",
      events: [
        {
          entity: "IssuedInvoice",
          action: "PaymentCreated",
          entity_id: 987654,
          agenda_id: null,
          event_date: "2023-10-01T00:00:00Z",
        },
      ],
    })
  })

  it("tolerates a bare event and an array of events", () => {
    expect(extractIdokladDelivery(documented.Events[0]).events).toHaveLength(1)
    expect(extractIdokladDelivery([documented.Events[0], documented.Events[0]]).events).toHaveLength(2)
  })

  it("yields nothing for junk bodies", () => {
    expect(extractIdokladDelivery(null).events).toEqual([])
    expect(extractIdokladDelivery("text").events).toEqual([])
    expect(extractIdokladDelivery({ hello: "world" }).events).toEqual([])
  })
})

describe("event filtering — IssuedInvoice + PaymentCreated", () => {
  it("recognizes the textual names iDoklad sends and the numeric enums of registration", () => {
    expect(isIssuedInvoiceEntity("IssuedInvoice")).toBe(true)
    expect(isIssuedInvoiceEntity(0)).toBe(true)
    expect(isIssuedInvoiceEntity("CreditNote")).toBe(false)
    expect(isIssuedInvoiceEntity(3)).toBe(false)

    expect(isPaymentCreatedAction("PaymentCreated")).toBe(true)
    expect(isPaymentCreatedAction(4)).toBe(true)
    expect(isPaymentCreatedAction("PaymentDeleted")).toBe(false)
    expect(isPaymentCreatedAction("Insert")).toBe(false)
    expect(isPaymentCreatedAction(5)).toBe(false)
  })

  it("accepts only complete invoice-payment events", () => {
    const [event] = extractIdokladDelivery(documented).events
    expect(isInvoicePaymentEvent(event)).toBe(true)
    expect(isInvoicePaymentEvent({ ...event, action: "Update" })).toBe(false)
    expect(isInvoicePaymentEvent({ ...event, entity: "ProformaInvoice" })).toBe(false)
    expect(isInvoicePaymentEvent({ ...event, entity_id: null })).toBe(false)
  })
})

describe("invoicePaymentVerdict — only a fully paid invoice records the dobírka", () => {
  it("maps PaymentStatus 0/1/2/3", () => {
    expect(invoicePaymentVerdict({ PaymentStatus: 1 })).toBe("paid")
    expect(invoicePaymentVerdict({ PaymentStatus: 3 })).toBe("paid")
    expect(invoicePaymentVerdict({ PaymentStatus: 2 })).toBe("partial")
    expect(invoicePaymentVerdict({ PaymentStatus: 0 })).toBe("unpaid")
    expect(invoicePaymentVerdict({})).toBe("unpaid")
    expect(invoicePaymentVerdict(null)).toBe("unpaid")
  })
})
