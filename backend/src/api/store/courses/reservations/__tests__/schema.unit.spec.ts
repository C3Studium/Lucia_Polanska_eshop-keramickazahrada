import {
  buildReservationConsents,
  EXCEPTION_REQUIRED_MESSAGE,
  parseReservation,
  TERMS_REQUIRED_MESSAGE,
} from "../schema"

/**
 * Veřejná rezervace kurzu: bez souhlasu s OP a bez potvrzeného poučení
 * o výjimce z odstoupení (§ 1837 písm. j) OZ) se nepřijme — a hláška musí
 * být česká, protože ji storefront ukazuje zákazníkovi tak, jak přijde.
 */

const valid = {
  term_id: "term_1",
  name: "Jana Nováková",
  email: "jana@example.cz",
  phone: "+420 777 123 456",
  party_size: 2,
  payment_method: "online" as const,
  terms_accepted: true,
  exception_ack: true,
}

describe("course reservation schema — consents", () => {
  it("accepts a reservation with both required consents", () => {
    const result = parseReservation(valid)
    expect(result.ok).toBe(true)
  })

  it("rejects a missing terms consent with a Czech message", () => {
    const { terms_accepted, ...rest } = valid
    const result = parseReservation(rest)
    expect(result).toEqual({ ok: false, message: TERMS_REQUIRED_MESSAGE })
  })

  it("rejects terms_accepted: false", () => {
    const result = parseReservation({ ...valid, terms_accepted: false })
    expect(result).toEqual({ ok: false, message: TERMS_REQUIRED_MESSAGE })
  })

  it("rejects a missing § 1837 j) acknowledgement", () => {
    const { exception_ack, ...rest } = valid
    const result = parseReservation(rest)
    expect(result).toEqual({ ok: false, message: EXCEPTION_REQUIRED_MESSAGE })
  })

  it("does not accept a truthy string in place of true", () => {
    const result = parseReservation({ ...valid, exception_ack: "true" })
    expect(result.ok).toBe(false)
  })

  it("keeps the photo consent optional", () => {
    expect(parseReservation({ ...valid, photo_consent: false }).ok).toBe(true)
    expect(parseReservation({ ...valid, photo_consent: true }).ok).toBe(true)
  })

  it("still reports the contact fields first, in Czech", () => {
    const result = parseReservation({ ...valid, email: "nope" })
    expect(result).toEqual({
      ok: false,
      message: "Zkontrolujte prosím e-mailovou adresu.",
    })
  })

  it("falls back to the generic Czech message for English zod errors", () => {
    const result = parseReservation({ ...valid, party_size: "dva" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("Zkontrolujte prosím")
  })
})

describe("course reservation — buildReservationConsents", () => {
  const now = new Date("2026-10-14T10:00:00.000Z")

  it("stamps server time and keeps what the storefront sent", () => {
    const parsed = parseReservation({
      ...valid,
      photo_consent: true,
      terms_version: "2026-10-15",
      client_accepted_at: "2026-10-14T09:59:58.000Z",
      cancellation_terms_text_version: "2026-10-15:a1b2c3d4",
    })
    if (!parsed.ok) throw new Error(parsed.message)

    expect(buildReservationConsents(parsed.data, now)).toEqual({
      terms_version: "2026-10-15",
      accepted_at: "2026-10-14T10:00:00.000Z",
      client_accepted_at: "2026-10-14T09:59:58.000Z",
      exception_ack: true,
      photo_consent: true,
      cancellation_terms_text_version: "2026-10-15:a1b2c3d4",
    })
  })

  it("records no photo consent unless it was given", () => {
    const parsed = parseReservation(valid)
    if (!parsed.ok) throw new Error(parsed.message)
    const consents = buildReservationConsents(parsed.data, now)
    expect(consents.photo_consent).toBe(false)
    expect(consents.terms_version).toBeNull()
  })

  it("drops a client time that is not a date", () => {
    const parsed = parseReservation({ ...valid, client_accepted_at: "včera" })
    if (!parsed.ok) throw new Error(parsed.message)
    expect(buildReservationConsents(parsed.data, now).client_accepted_at).toBeNull()
  })
})
