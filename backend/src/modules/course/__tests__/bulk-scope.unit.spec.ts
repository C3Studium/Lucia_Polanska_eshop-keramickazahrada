import { resolveScopeTermIds, type ScopeCandidate } from "../bulk-scope"

const NOW = new Date("2026-10-10T12:00:00.000Z")

const term = (
  id: string,
  day: string,
  status: string = "published"
): ScopeCandidate => ({
  id,
  // 17:00 Prague — comfortably inside the day either side of a DST change.
  starts_at: `${day}T15:00:00.000Z`,
  status,
})

const catalog: ScopeCandidate[] = [
  term("past", "2026-09-20"),
  term("soon", "2026-10-15"),
  term("mid", "2026-10-25"),
  term("late", "2026-11-20"),
  term("cancelled", "2026-10-18", "cancelled"),
  term("finished_past", "2026-09-01", "finished"),
]

describe("resolveScopeTermIds", () => {
  it("takes exactly the named terms", () => {
    expect(
      resolveScopeTermIds(catalog, { kind: "terms", ids: ["soon", "late"] }, NOW)
    ).toEqual(["soon", "late"])
  })

  it("lets an explicit id reach a past term — the owner named it", () => {
    expect(
      resolveScopeTermIds(catalog, { kind: "terms", ids: ["past"] }, NOW)
    ).toEqual(["past"])
  })

  it("never touches a cancelled term, even when named outright", () => {
    expect(
      resolveScopeTermIds(
        catalog,
        { kind: "terms", ids: ["cancelled", "soon"] },
        NOW
      )
    ).toEqual(["soon"])
  })

  it("„všechny nadcházející\" leaves the past alone", () => {
    expect(resolveScopeTermIds(catalog, { kind: "all_upcoming" }, NOW)).toEqual([
      "soon",
      "mid",
      "late",
    ])
  })

  it("takes a period by Prague day, both ends inclusive", () => {
    expect(
      resolveScopeTermIds(
        catalog,
        { kind: "period", from: "2026-10-15", to: "2026-10-25" },
        NOW
      )
    ).toEqual(["soon", "mid"])
  })

  it("reads a reversed period as the range the owner meant", () => {
    expect(
      resolveScopeTermIds(
        catalog,
        { kind: "period", from: "2026-10-25", to: "2026-10-15" },
        NOW
      )
    ).toEqual(["soon", "mid"])
  })

  it("a period cannot reach backwards into the past", () => {
    expect(
      resolveScopeTermIds(
        catalog,
        { kind: "period", from: "2026-01-01", to: "2026-12-31" },
        NOW
      )
    ).toEqual(["soon", "mid", "late"])
  })

  it("counts a term starting this very moment as upcoming", () => {
    const boundary: ScopeCandidate[] = [
      { id: "now", starts_at: NOW.toISOString(), status: "published" },
    ]
    expect(
      resolveScopeTermIds(boundary, { kind: "all_upcoming" }, NOW)
    ).toEqual(["now"])
  })

  it("survives an empty catalog and an empty id list", () => {
    expect(resolveScopeTermIds([], { kind: "all_upcoming" }, NOW)).toEqual([])
    expect(
      resolveScopeTermIds(catalog, { kind: "terms", ids: [] }, NOW)
    ).toEqual([])
  })
})
