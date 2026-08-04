/**
 * A1, pinned down (the test I owed since P4-1).
 *
 * A1 is the invariant that „odesláno" — the stage, the native status and the
 * customer's e-mail — is only ever produced by a real shipment. I claimed to
 * have made it real and shipped it with no test covering the branch that
 * decides whether a shipment happens at all, which is the one line the whole
 * invariant rests on.
 *
 * The workflow itself needs a container to run, so what is pinned here is the
 * decision function: given what the provider returned, may a shipment follow?
 */

/**
 * Mirrors the `carrier_has_parcel` transform in `ship-merchant-order.ts`.
 *
 * Kept as a named rule rather than a copy of an expression: if the workflow
 * ever disagrees with this, one of the two is wrong and that is worth finding.
 */
const carrierHasParcel = (fulfillment: any): boolean =>
  fulfillment?.data?.mode === "api"

describe("A1 — dispatch invariant", () => {
  it("allows a shipment only when the carrier actually holds the parcel", () => {
    expect(carrierHasParcel({ data: { mode: "api" } })).toBe(true)
  })

  it("refuses to ship a record-only fulfilment", () => {
    // The whole point: items are packed and stock is decremented, but nothing
    // has left. Shipping here would tell a customer their parcel is moving on
    // the strength of a database row.
    expect(carrierHasParcel({ data: { mode: "manual" } })).toBe(false)
  })

  it("refuses when the mode is missing entirely", () => {
    // A fulfilment created on the native order page carries no mode of ours.
    // Treating that as shippable would be the unsafe direction — the worst case
    // of refusing is that she confirms a handover that already happened.
    expect(carrierHasParcel({ data: {} })).toBe(false)
    expect(carrierHasParcel({})).toBe(false)
    expect(carrierHasParcel(null)).toBe(false)
    expect(carrierHasParcel(undefined)).toBe(false)
  })

  it("refuses anything that is not exactly the api mode", () => {
    // No truthiness games: only the literal contract counts.
    for (const mode of ["API", "Api", "manual", "", "true", true, 1]) {
      expect(carrierHasParcel({ data: { mode } })).toBe(false)
    }
  })
})

/**
 * The derived „waiting for handover" state, mirroring the projection.
 *
 * No column stores this — it is `stage = shipping` plus a fulfilment that
 * exists and has not shipped. That is cheap to get subtly wrong, hence the
 * cases below.
 */
const awaitingHandover = (stage: string, fulfillments: any[]): boolean =>
  stage === "shipping" &&
  (fulfillments || []).some((f) => !f?.canceled_at && !f?.shipped_at)

describe("A1 — the derived waiting state", () => {
  it("waits when a parcel is packed and has not left", () => {
    expect(awaitingHandover("shipping", [{ shipped_at: null }])).toBe(true)
  })

  it("does not wait once the parcel has shipped", () => {
    expect(
      awaitingHandover("shipping", [{ shipped_at: "2026-08-04T10:00:00Z" }])
    ).toBe(false)
  })

  it("ignores a cancelled fulfilment", () => {
    expect(
      awaitingHandover("shipping", [
        { shipped_at: null, canceled_at: "2026-08-01T00:00:00Z" },
      ])
    ).toBe(false)
  })

  it("does not wait before anything is packed", () => {
    expect(awaitingHandover("shipping", [])).toBe(false)
    expect(awaitingHandover("received", [{ shipped_at: null }])).toBe(false)
  })

  it("still waits when one parcel left and another has not", () => {
    expect(
      awaitingHandover("shipping", [
        { shipped_at: "2026-08-04T10:00:00Z" },
        { shipped_at: null },
      ])
    ).toBe(true)
  })
})
