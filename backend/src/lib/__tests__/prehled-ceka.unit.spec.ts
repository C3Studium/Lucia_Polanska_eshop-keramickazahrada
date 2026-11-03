import {
  claimsWaiting,
  commissionsWaitingForOwner,
  orderChangeRequests,
  parcelIssues,
} from "../prehled-ceka"

const NOW = new Date("2026-11-03T12:00:00Z")
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

describe("commissionsWaitingForOwner", () => {
  const agreedPrice = (production: any) => Boolean(production.por)

  it("počítá nové zadání a cenu po domluvě, která ještě neodešla", () => {
    const rows = [
      { id: "a", stage: "specification_pending" },
      { id: "b", stage: "confirmed", por: true, agreed_total: 0, final_total_confirmed_at: null },
      // cena odešla → čeká se na zákazníka
      { id: "c", stage: "confirmed", por: true, agreed_total: 4200, final_total_confirmed_at: daysAgo(1) },
      // běžná potvrzená zakázka → nic nečeká
      { id: "d", stage: "confirmed", por: false, agreed_total: 0 },
      { id: "e", stage: "in_production" },
    ]
    expect(commissionsWaitingForOwner(rows, agreedPrice).map((row) => row.id)).toEqual(["a", "b"])
  })

  it("BigNumber z modulu bere jako číslo", () => {
    const rows = [{ stage: "confirmed", por: true, agreed_total: { value: "1500" } }]
    expect(commissionsWaitingForOwner(rows, agreedPrice)).toHaveLength(0)
  })
})

describe("claimsWaiting", () => {
  it("prošlá žádost se počítá jen jednou — mezi prošlé", () => {
    const result = claimsWaiting(
      [
        { id: "new", status: "pending", resolve_by: daysAgo(-10) },
        { id: "late", status: "pending", resolve_by: daysAgo(2) },
        { id: "later", status: "received", resolve_by: daysAgo(5) },
        { id: "goods", status: "received", resolve_by: daysAgo(-3) },
        // schválená = čeká na zboží od zákazníka, ne na ni
        { id: "wait", status: "approved", resolve_by: daysAgo(-3) },
        { id: "done", status: "resolved", resolve_by: daysAgo(20) },
      ],
      NOW
    )
    expect(result).toEqual({
      new: 1,
      received: 1,
      overdue: 2,
      overdue_first: { id: "later", status: "received" },
    })
  })

  it("bez lhůty je žádost prostě nová", () => {
    expect(claimsWaiting([{ id: "x", status: "pending", resolve_by: null }], NOW).new).toBe(1)
  })
})

describe("parcelIssues", () => {
  it("vrácené (7 dní), problém a dlouho uložené — v tomhle pořadí", () => {
    const issues = parcelIssues(
      [
        { order_id: "stored-long", phase: "stored", done: false, stored_at: daysAgo(6) },
        { order_id: "stored-fresh", phase: "stored", done: false, stored_at: daysAgo(2) },
        { order_id: "problem", phase: "problem", done: false, last_state_text: "Poškozená" },
        { order_id: "problem-done", phase: "problem", done: true },
        { order_id: "returned", phase: "returned", done: true, returned_at: daysAgo(1) },
        { order_id: "returned-old", phase: "returned", done: true, returned_at: daysAgo(30) },
        { order_id: "transit", phase: "in_transit", done: false },
      ],
      NOW
    )
    expect(issues.map((issue) => [issue.order_id, issue.kind, issue.days])).toEqual([
      ["returned", "returned", 1],
      ["problem", "problem", null],
      ["stored-long", "stored", 6],
    ])
    expect(issues[1].text).toBe("Poškozená")
  })
})

describe("orderChangeRequests", () => {
  it("jedna objednávka = jedna žádost, nejnovější napřed, bez objednávky pryč", () => {
    expect(
      orderChangeRequests([
        { resource_id: "o1", created_at: daysAgo(2) },
        { resource_id: "o2", created_at: daysAgo(1) },
        { resource_id: "o1", created_at: daysAgo(0.5) },
        { resource_id: null, created_at: daysAgo(0) },
      ]).map((row) => row.order_id)
    ).toEqual(["o1", "o2"])
  })
})
