import { commissionPaymentsText, splitCommissionPayments } from "../commission-breakdown"

describe("splitCommissionPayments", () => {
  it("#50: záloha 1 125, doplatek 3 775 vč. příplatku 400", () => {
    const split = splitCommissionPayments({
      requests: [
        { type: "deposit", status: "paid", amount: 1125 },
        { type: "balance", status: "paid", amount: 3775 },
      ],
      surcharge: 400,
    })
    expect(split).toEqual({ deposit: 1125, balance: 3375, surcharge: 400, totalPaid: 4900 })
  })

  it("nezaplacené žádosti se nepočítají, příplatek nepřeroste doplatek", () => {
    const split = splitCommissionPayments({
      requests: [
        { type: "deposit", status: "paid", amount: { value: "1225" } },
        { type: "balance", status: "sent", amount: 3000 },
        { type: "balance", status: "paid", amount: 200 },
      ],
      surcharge: 500,
    })
    expect(split).toEqual({ deposit: 1225, balance: 0, surcharge: 200, totalPaid: 1425 })
  })

  it("text pro e-mail vynechá prázdný příplatek", () => {
    const text = commissionPaymentsText(
      { deposit: 1075, balance: 3225, surcharge: 0, totalPaid: 4300 },
      (n) => `${n} Kč`,
      "20260020"
    )
    expect(text).toEqual({
      deposit: "1075 Kč",
      depositInvoiceNumber: "20260020",
      balance: "3225 Kč",
      surcharge: null,
      totalPaid: "4300 Kč",
    })
  })
})
