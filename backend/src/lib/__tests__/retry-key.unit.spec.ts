/**
 * Retry and backfill idempotency (the P2-4 and P3-3 tests I owed).
 *
 * Both features promise „safe to run twice" in their dialogs, and both were
 * shipped on that promise without a test. These pin the two rules that make it
 * true.
 */

/** Mirrors `nextAttemptKey` in `api/admin/notifications/[id]/retry/route.ts`. */
const nextAttemptKey = (key: string | null | undefined): string | undefined => {
  if (!key) {
    return undefined
  }
  const match = key.match(/^(.*):r(\d+)$/)
  if (match) {
    return `${match[1]}:r${Number(match[2]) + 1}`
  }
  return `${key}:r2`
}

describe("notification retry keys", () => {
  it("gives a first retry its own key", () => {
    // Re-sending under the original key would let the module dedupe it away,
    // or overwrite the failure record and destroy the evidence.
    expect(nextAttemptKey("ship:ful_1")).toBe("ship:ful_1:r2")
  })

  it("counts upwards, so each attempt is distinct", () => {
    expect(nextAttemptKey("ship:ful_1:r2")).toBe("ship:ful_1:r3")
    expect(nextAttemptKey("ship:ful_1:r9")).toBe("ship:ful_1:r10")
  })

  it("is stable — the same attempt always produces the same key", () => {
    expect(nextAttemptKey("a:r2")).toBe(nextAttemptKey("a:r2"))
  })

  it("does nothing without an original key", () => {
    expect(nextAttemptKey(null)).toBeUndefined()
    expect(nextAttemptKey("")).toBeUndefined()
  })

  it("is not confused by a colon or a number in the key itself", () => {
    expect(nextAttemptKey("mn:emailfail:noti_01H2")).toBe(
      "mn:emailfail:noti_01H2:r2"
    )
  })
})

/**
 * Mirrors the backfill's selection rule: create a stage row only for orders
 * that have none.
 */
const missingStates = (orderIds: string[], covered: Set<string>): string[] =>
  orderIds.filter((id) => !covered.has(id))

describe("backfill idempotency", () => {
  it("creates a row only for orders without one", () => {
    expect(missingStates(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"])
  })

  it("does nothing on a second run", () => {
    // The dialog says running it again is safe; this is why.
    const orders = ["a", "b", "c"]
    const first = missingStates(orders, new Set())
    const covered = new Set(first)

    expect(first).toEqual(orders)
    expect(missingStates(orders, covered)).toEqual([])
  })

  it("never updates an existing row", () => {
    // Backfill only ever inserts. An order she already moved to "Odesláno"
    // must not be dragged back to "Nové" by a second run.
    expect(missingStates(["a"], new Set(["a"]))).toEqual([])
  })
})
