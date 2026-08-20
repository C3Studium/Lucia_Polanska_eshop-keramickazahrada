import {
  COURSE_SELF_SERVICE_CUTOFF_HOURS,
  COURSE_SELF_SERVICE_TOO_LATE,
  CUSTOMER_CANCEL_REASON,
  canCustomerEditParty,
  courseConfirmUpdatedKey,
  isBeforeSelfServiceCutoff,
  selfServiceDeadline,
} from "../lifecycle"
import CourseModuleService from "../service"

/**
 * The customer self-service rules: the 48h cutoff both routes share, the
 * edit eligibility (never under a landed card payment) and the values the
 * database and the mailer key on. Pinning the reason string matters because
 * the DB check constraint enumerates it — a drifted spelling would pass
 * typecheck and fail the first customer's cancel in production.
 *
 * The atomic customer cancel (`cancelReservationByCustomer`) is pinned here
 * too, on the fake-transaction-manager pattern of `party-size-update`: the
 * conditional WHERE is what turns two racing tabs into one refund.
 */

const NOW = new Date("2026-08-20T10:00:00Z")
const hoursFromNow = (hours: number): string =>
  new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString()

describe("self-service cutoff", () => {
  it("is 48 hours, and the refusal names them", () => {
    expect(COURSE_SELF_SERVICE_CUTOFF_HOURS).toBe(48)
    expect(COURSE_SELF_SERVICE_TOO_LATE).toContain("48 hodin")
  })

  it("allows changes while more than 48 hours remain", () => {
    expect(isBeforeSelfServiceCutoff(hoursFromNow(49), NOW)).toBe(true)
    expect(isBeforeSelfServiceCutoff(hoursFromNow(24 * 14), NOW)).toBe(true)
  })

  it("refuses at and inside the 48h window — and for past terms", () => {
    expect(isBeforeSelfServiceCutoff(hoursFromNow(48), NOW)).toBe(false)
    expect(isBeforeSelfServiceCutoff(hoursFromNow(47.5), NOW)).toBe(false)
    expect(isBeforeSelfServiceCutoff(hoursFromNow(1), NOW)).toBe(false)
    expect(isBeforeSelfServiceCutoff(hoursFromNow(-3), NOW)).toBe(false)
  })

  it("refuses an unparsable start instead of guessing", () => {
    expect(isBeforeSelfServiceCutoff("not-a-date", NOW)).toBe(false)
    expect(selfServiceDeadline("not-a-date")).toBeNull()
  })

  it("puts the deadline exactly 48 hours before the start", () => {
    const deadline = selfServiceDeadline(hoursFromNow(72))
    expect(deadline?.toISOString()).toBe(hoursFromNow(24))
  })
})

describe("canCustomerEditParty", () => {
  it("allows pay-on-site and online-unpaid reservations", () => {
    expect(
      canCustomerEditParty({
        status: "active",
        payment_method: "on_site",
        payment_status: "on_site",
      })
    ).toBe(true)
    expect(
      canCustomerEditParty({
        status: "active",
        payment_method: "online",
        payment_status: "pending",
        paid_at: null,
      })
    ).toBe(true)
  })

  it("never allows editing under a landed card payment — either signal counts", () => {
    expect(
      canCustomerEditParty({
        status: "active",
        payment_method: "online",
        payment_status: "paid",
      })
    ).toBe(false)
    // `paid_at` stamped but status not yet flipped — the subscriber race.
    expect(
      canCustomerEditParty({
        status: "active",
        payment_method: "online",
        payment_status: "pending",
        paid_at: "2026-08-19T10:00:00Z",
      })
    ).toBe(false)
  })

  it("refuses cancelled reservations regardless of payment", () => {
    expect(
      canCustomerEditParty({
        status: "cancelled",
        payment_method: "on_site",
        payment_status: "on_site",
      })
    ).toBe(false)
  })
})

describe("customer cancel bookkeeping values", () => {
  it("files under the reason the DB constraint enumerates", () => {
    expect(CUSTOMER_CANCEL_REASON).toBe("customer")
  })

  it("keys the updated confirmation per reservation AND size, so repeat edits re-send", () => {
    expect(courseConfirmUpdatedKey("res_1", 3)).toBe(
      "course-confirm:updated:res_1:3"
    )
    expect(courseConfirmUpdatedKey("res_1", 4)).not.toBe(
      courseConfirmUpdatedKey("res_1", 3)
    )
  })
})

describe("cancelReservationByCustomer — the atomic conditional cancel", () => {
  const service = Object.create(
    CourseModuleService.prototype
  ) as CourseModuleService

  const makeManager = (rows: Record<string, unknown>[]) => {
    const calls: { sql: string; params: unknown[] }[] = []
    return {
      calls,
      execute: jest.fn(async (sql: string, params: unknown[]) => {
        calls.push({ sql, params })
        return rows
      }),
    }
  }

  it("cancels in one conditional UPDATE and returns the row it wrote", async () => {
    const row = {
      id: "res_1",
      status: "cancelled",
      cancel_reason: "customer",
      payment_status: "paid",
      paid_at: "2026-08-20T10:00:00Z",
    }
    const manager = makeManager([row])

    const result = await service.cancelReservationByCustomer("res_1", {
      transactionManager: manager as never,
    })

    expect(result).toEqual(row)
    const { sql, params } = manager.calls[0]
    // One statement, guarded and returning: the WHERE re-checks the row is
    // still active (two tabs → one cancel), RETURNING hands the route the
    // payment fields as of the cancel (a capture that raced us is seen).
    expect(sql).toContain(`"status" = 'cancelled'`)
    expect(sql).toContain(`"cancel_reason" = '${CUSTOMER_CANCEL_REASON}'`)
    expect(sql).toContain(`and "status" = 'active'`)
    expect(sql).toContain("returning *")
    expect(params).toEqual(["res_1"])
  })

  it("returns null when the row was no longer active — the losing tab's answer", async () => {
    const manager = makeManager([])

    const result = await service.cancelReservationByCustomer("res_1", {
      transactionManager: manager as never,
    })

    expect(result).toBeNull()
  })
})
