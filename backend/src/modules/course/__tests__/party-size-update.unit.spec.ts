import CourseModuleService from "../service"

/**
 * The atomic party-size update, on a fake transaction manager — the
 * fake-container pattern: the service instance is created without a real
 * container (`Object.create` + a stubbed generated update method), and the
 * `@InjectTransactionManager` decorator short-circuits to the original method
 * because the context already carries a transactionManager.
 *
 * What is pinned:
 * - the term row is locked (`for update`) BEFORE seats are counted,
 * - the seat count excludes the edited reservation itself (its old size is
 *   being replaced, not added to),
 * - a size that does not fit refuses with the honest Czech remainder,
 * - the price is recomputed from the locked term row (tier and total),
 * - a pending online payment link is cleared (it carried the old amount) —
 *   and an on-site reservation's fields are left alone.
 */

const FUTURE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

type Row = Record<string, unknown>

const makeFakeManager = ({
  reservation,
  term,
  takenByOthers,
}: {
  reservation: Row | null
  term: Row | null
  takenByOthers: number
}) => {
  const calls: { sql: string; params: unknown[] }[] = []
  return {
    calls,
    execute: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params })
      if (sql.includes('from "course_reservation"') && sql.includes("select *")) {
        return reservation ? [reservation] : []
      }
      if (sql.includes('from "course_term"')) {
        return term ? [term] : []
      }
      if (sql.includes("coalesce(sum")) {
        return [{ taken: takenByOthers }]
      }
      throw new Error(`unexpected sql in fake manager: ${sql}`)
    }),
  }
}

const baseTerm = (): Row => ({
  id: "term_1",
  status: "published",
  starts_at: FUTURE,
  capacity: 10,
  price_single: 800,
  price_two: 700,
  group_min: 4,
  price_group_per_person: 600,
})

const baseReservation = (overrides: Row = {}): Row => ({
  id: "res_1",
  term_id: "term_1",
  status: "active",
  party_size: 1,
  payment_method: "on_site",
  payment_status: "on_site",
  paid_at: null,
  ...overrides,
})

const makeService = () => {
  const service = Object.create(
    CourseModuleService.prototype
  ) as CourseModuleService & { updateCourseReservations: jest.Mock }
  service.updateCourseReservations = jest.fn(async (data: Row) => ({
    ...baseReservation(),
    ...data,
  }))
  return service
}

const run = (
  service: CourseModuleService,
  manager: ReturnType<typeof makeFakeManager>,
  partySize: number,
  reservationId = "res_1"
) =>
  service.updateReservationPartySize(
    { reservation_id: reservationId, party_size: partySize },
    { transactionManager: manager as never }
  )

describe("updateReservationPartySize", () => {
  it("recomputes tier and total from the locked term row (pair pricing)", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation(),
      term: baseTerm(),
      takenByOthers: 5,
    })

    const { reservation } = await run(service, manager, 2)

    expect(service.updateCourseReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "res_1",
        party_size: 2,
        pricing_tier: "pair",
        total_price: 1400,
      }),
      expect.anything()
    )
    expect(reservation.party_size).toBe(2)
  })

  it("uses the group rate once the threshold is met", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation(),
      term: baseTerm(),
      takenByOthers: 5,
    })

    await run(service, manager, 4)

    expect(service.updateCourseReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        party_size: 4,
        pricing_tier: "group",
        total_price: 2400,
      }),
      expect.anything()
    )
  })

  it("locks the term row before counting, and counts everyone but this reservation", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation(),
      term: baseTerm(),
      takenByOthers: 5,
    })

    await run(service, manager, 3)

    const lockIndex = manager.calls.findIndex((call) =>
      call.sql.includes("for update")
    )
    const countIndex = manager.calls.findIndex((call) =>
      call.sql.includes("coalesce(sum")
    )
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(manager.calls[lockIndex].sql).toContain('"course_term"')
    expect(countIndex).toBeGreaterThan(lockIndex)
    expect(manager.calls[countIndex].sql).toContain(`"id" != ?`)
    expect(manager.calls[countIndex].params).toContain("res_1")
  })

  it("refuses a size that no longer fits — with the honest remainder", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation(),
      term: baseTerm(),
      takenByOthers: 8,
    })

    await expect(run(service, manager, 3)).rejects.toThrow(
      "zbývá už jen 2 místa"
    )
    expect(service.updateCourseReservations).not.toHaveBeenCalled()
  })

  it("refuses a full term outright", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation(),
      term: baseTerm(),
      takenByOthers: 10,
    })

    await expect(run(service, manager, 1)).rejects.toThrow("plně obsazený")
  })

  it("clears the stale payment link of an online-unpaid reservation", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation({
        payment_method: "online",
        payment_status: "pending",
        payment_collection_id: "paycol_1",
        payment_session_id: "payses_1",
        payment_url: "https://comgate.example/pay",
      }),
      term: baseTerm(),
      takenByOthers: 0,
    })

    await run(service, manager, 2)

    expect(service.updateCourseReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_collection_id: null,
        payment_session_id: null,
        payment_url: null,
      }),
      expect.anything()
    )
  })

  it("leaves an on-site reservation's payment fields alone", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: baseReservation(),
      term: baseTerm(),
      takenByOthers: 0,
    })

    await run(service, manager, 2)

    const payload = service.updateCourseReservations.mock.calls[0][0]
    expect(payload).not.toHaveProperty("payment_collection_id")
    expect(payload).not.toHaveProperty("payment_url")
  })

  it("refuses when a card payment landed before the lock — either signal, re-checked in-transaction", async () => {
    // The route's eligibility check ran on a pre-read; the ComGate subscriber
    // may stamp the payment in the window before our lock. The method must
    // re-decide on the locked row — a paid reservation's amount is fixed.
    const paidByStatus = makeFakeManager({
      reservation: baseReservation({
        payment_method: "online",
        payment_status: "paid",
      }),
      term: baseTerm(),
      takenByOthers: 0,
    })
    await expect(run(makeService(), paidByStatus, 2)).rejects.toThrow(
      "Zaplacenou rezervaci"
    )

    const paidByStamp = makeFakeManager({
      reservation: baseReservation({
        payment_method: "online",
        payment_status: "pending",
        paid_at: "2026-08-19T10:00:00Z",
      }),
      term: baseTerm(),
      takenByOthers: 0,
    })
    const service = makeService()
    await expect(run(service, paidByStamp, 2)).rejects.toThrow(
      "Zaplacenou rezervaci"
    )
    expect(service.updateCourseReservations).not.toHaveBeenCalled()
  })

  it("refuses cancelled reservations, non-published terms and nonsense sizes", async () => {
    const service = makeService()

    await expect(
      run(
        service,
        makeFakeManager({
          reservation: baseReservation({ status: "cancelled" }),
          term: baseTerm(),
          takenByOthers: 0,
        }),
        2
      )
    ).rejects.toThrow("Zrušenou rezervaci")

    await expect(
      run(
        service,
        makeFakeManager({
          reservation: baseReservation(),
          term: { ...baseTerm(), status: "cancelled" },
          takenByOthers: 0,
        }),
        2
      )
    ).rejects.toThrow("není možné upravit")

    await expect(
      run(
        service,
        makeFakeManager({
          reservation: baseReservation(),
          term: baseTerm(),
          takenByOthers: 0,
        }),
        0
      )
    ).rejects.toThrow("alespoň 1")
  })

  it("404s an unknown reservation", async () => {
    const service = makeService()
    const manager = makeFakeManager({
      reservation: null,
      term: baseTerm(),
      takenByOthers: 0,
    })

    await expect(run(service, manager, 2, "res_missing")).rejects.toThrow(
      "Rezervace nebyla nalezena."
    )
  })
})
