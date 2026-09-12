import { duvodCesky } from "../../jobs/reconcile-checkout-payments"

describe("duvodCesky", () => {
  it("přeloží důvod, který brána opravdu posílá", () => {
    /* NO_FUNDS je změřený na živé transakci XMSU-95NU-U8CE (11. 9. 2026). */
    expect(duvodCesky("NO_FUNDS")).toBe("na účtu nebyl dostatek prostředků")
    expect(duvodCesky("REJECTED_BY_BANK")).toBe("platbu zamítla banka")
  })

  it("nezáleží na velikosti písmen ani na mezerách", () => {
    expect(duvodCesky(" no_funds ")).toBe("na účtu nebyl dostatek prostředků")
  })

  it("nespecifikováno není důvod — to je storno, ne selhání", () => {
    expect(duvodCesky("NOT_SPECIFIED")).toBeNull()
  })

  it("neznámý nebo chybějící kód radši mlčí, než aby si vymýšlel", () => {
    expect(duvodCesky("NECO_NOVEHO")).toBeNull()
    expect(duvodCesky(undefined)).toBeNull()
    expect(duvodCesky("")).toBeNull()
  })
})
