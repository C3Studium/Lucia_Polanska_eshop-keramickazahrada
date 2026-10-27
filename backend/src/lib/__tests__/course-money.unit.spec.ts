import { moneyFor, reservationCollectionIds } from "../course-money"

describe("evidence peněz rezervace kurzu", () => {
  it("zbývá = cena − zaplaceno, nikdy pod nulu", () => {
    expect(moneyFor({ total: 1700, paid: 900, cancelled: false })).toEqual({ paid_amount: 900, amount_due: 800 })
    expect(moneyFor({ total: 900, paid: 1700, cancelled: false })).toEqual({ paid_amount: 1700, amount_due: 0 })
    expect(moneyFor({ total: 900, paid: 900, cancelled: false })).toEqual({ paid_amount: 900, amount_due: 0 })
  })

  it("zrušená rezervace nic nedluží", () => {
    expect(moneyFor({ total: 900, paid: 0, cancelled: true })).toEqual({ paid_amount: 0, amount_due: 0 })
  })

  it("kolekce plateb: prvotní + doplatky (ne vratky)", () => {
    expect(
      reservationCollectionIds({ payment_collection_id: "pc_1" }, [
        { type: "supplement", payment_collection_id: "pc_2" },
        { type: "refund", payment_collection_id: null },
      ])
    ).toEqual(["pc_1", "pc_2"])
  })
})
