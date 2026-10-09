import {
  BALANCE_COLLECTION_FLAG,
  findOpenBalanceCollection,
} from "../balance-payment"

/**
 * Jediná otevřená kolekce doplatku (změřeno 9. 10. 2026 na #27/#25): bez ní
 * Medusa hlásí „zaplaceno" po záloze, se dvěma se objednávka nikdy nedoplatí.
 */
describe("otevřená kolekce doplatku", () => {
  it("vybere označenou kolekci přednostně před jinou otevřenou", () => {
    const order = {
      payment_collections: [
        { id: "a", status: "not_paid", amount: 3225, captured_amount: 0 },
        { id: "b", status: "not_paid", amount: 3725, captured_amount: 0, metadata: { [BALANCE_COLLECTION_FLAG]: true } },
      ],
    }
    expect(findOpenBalanceCollection(order)?.id).toBe("b")
  })

  it("zachycenou ani dokončenou kolekci nebere; bez otevřené vrací null", () => {
    expect(
      findOpenBalanceCollection({
        payment_collections: [
          { id: "dep", status: "completed", amount: 1225, captured_amount: 1225 },
          { id: "x", status: "not_paid", amount: 100, captured_amount: { value: "100" } },
        ],
      })
    ).toBeNull()
    expect(findOpenBalanceCollection({ payment_collections: [] })).toBeNull()
  })

  it("starší objednávka bez značky: první otevřená kolekce", () => {
    const order = {
      payment_collections: [
        { id: "dep", status: "completed", amount: 1075, captured_amount: 1075 },
        { id: "bal", status: "not_paid", amount: 3225, captured_amount: null },
      ],
    }
    expect(findOpenBalanceCollection(order)?.id).toBe("bal")
  })
})
