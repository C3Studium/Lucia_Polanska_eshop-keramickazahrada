import { agreedTotalFor, resolveAgreedDeposit } from "../made-to-order/agreed-price"
import { commissionMoney, agreedExtrasTotal } from "../made-to-order/commission-money"
import { productionOutstanding } from "../ship-gate"

describe("resolveAgreedDeposit — záloha se domlouvá v korunách", () => {
  it("zadaná částka platí a procento se dopočítá", () => {
    expect(
      resolveAgreedDeposit({ agreedTotal: 2500, depositAmount: 1000 })
    ).toEqual({ amount: 1000, percentage: 40 })
  })

  it("strop je polovina ceny VÝROBKU (Z2)", () => {
    expect(
      resolveAgreedDeposit({ agreedTotal: 2000, depositAmount: 1000 }).amount
    ).toBe(1000)
    expect(() =>
      resolveAgreedDeposit({ agreedTotal: 2000, depositAmount: 1001 })
    ).toThrow(/nejvýš polovina/)
  })

  it("nulová ani záporná záloha neprojde", () => {
    for (const amount of [0, -100]) {
      expect(() =>
        resolveAgreedDeposit({ agreedTotal: 2000, depositAmount: amount })
      ).toThrow(/kladná částka/)
    }
  })

  it("bez částky se počítá po staru z procenta", () => {
    expect(
      resolveAgreedDeposit({ agreedTotal: 2000, depositPercentage: 25 })
    ).toEqual({ amount: 500, percentage: 25 })
    // Bez obojího spadne na uložené procento profilu.
    expect(
      resolveAgreedDeposit({ agreedTotal: 2000, storedPercentage: 30 })
    ).toEqual({ amount: 600, percentage: 30 })
  })

  it("drobná záloha se zaokrouhlí na procento v mezích, ne na nulu", () => {
    const { amount, percentage } = resolveAgreedDeposit({
      agreedTotal: 10000,
      depositAmount: 50,
    })
    expect(amount).toBe(50)
    // 0,5 % → zaokrouhlení dolů dá 0, meze profilu ho zvednou na 1.
    expect(percentage).toBe(1)
  })
})

describe("poštovné a balné domluvené s cenou", () => {
  const commission = {
    id: "po_1",
    stage: "confirmed",
    line_item_id: "li_1",
    line_total: 0,
    original_total: 0,
    agreed_total: 2500,
    shipping_total: 150,
    packaging_total: 100,
  }

  it("navyšují, co zákazník dluží", () => {
    expect(productionOutstanding({ ...commission, payment_requests: [] })).toBe(2750)
  })

  it("zaplacená záloha se od dluhu odečte", () => {
    expect(
      productionOutstanding({
        ...commission,
        payment_requests: [{ status: "paid", amount: 1000 }],
      })
    ).toBe(1750)
  })

  it("cenu výrobku nemění — záloha se počítá jen z ní", () => {
    const money = commissionMoney(commission, [])
    expect(money.item_total).toBe(2500)
    expect(agreedExtrasTotal(commission)).toBe(250)
    // „Navíc" patří objednávce, ne položce.
    expect(money.extras_total).toBe(250)
    expect(money.item_outstanding).toBe(2500)
  })

  it("bez nich zůstává všechno jako dřív", () => {
    const bez = { ...commission, shipping_total: null, packaging_total: null }
    expect(productionOutstanding({ ...bez, payment_requests: [] })).toBe(2500)
    expect(commissionMoney(bez, []).extras_total).toBe(0)
  })

  it("zrušená zakázka nedluží ani poštovné", () => {
    expect(
      productionOutstanding({ ...commission, stage: "cancelled", payment_requests: [] })
    ).toBe(0)
  })
})


describe("agreedTotalFor — domluvená cena nese objednávku", () => {
  /*
   * Proč to tu je (6. 11. 2026).
   *
   * `agreed_total` NAHRAZUJE `original_total`, a u nosné zakázky je
   * v `original_total` kromě ceny kusu i doprava, balné a běžné zboží
   * objednávky. Dokud se do `agreed_total` ukládala jen cena výrobku,
   * nesené „navíc" z dluhu vypadlo — ale jeho zaplacení z pokladny se dál
   * odečítalo, takže zákazník dlužil MÍŇ, než měl. V objednávce čistě na
   * zakázku s odběrem je nesené nula, proto si toho nikdo nevšiml.
   */
  const nosna = {
    id: "po_1",
    stage: "confirmed",
    line_item_id: "li_1",
    /* Kus s cenou po domluvě = objednaný za 0 Kč. */
    line_total: 0,
    /* 0 za kus + hrnek 400 + doprava 150 = nesené „navíc" 550. */
    original_total: 550,
    order_extras_paid: 550,
  }

  it("k ceně výrobku přičte, co zakázka nese za objednávku", () => {
    expect(agreedTotalFor(nosna, 2500)).toBe(3050)
  })

  it("zakázka, která nic nenese, dostane přesně domluvenou cenu", () => {
    const druha = { ...nosna, id: "po_2", original_total: 0, order_extras_paid: 0 }
    expect(agreedTotalFor(druha, 2500)).toBe(2500)
  })

  it("stará zakázka bez řádku nenese nic", () => {
    const legacy = { id: "po_old", line_item_id: null, line_total: null, original_total: 2579 }
    expect(agreedTotalFor(legacy, 2500)).toBe(2500)
  })

  it("dluh pak vyjde na cenu výrobku a nezaplacené nesené", () => {
    const ulozena = { ...nosna, agreed_total: agreedTotalFor(nosna, 2500) }
    /* V pokladně se zaplatilo nesené „navíc" (550) — zbývá cena výrobku. */
    const dluh = productionOutstanding({
      ...ulozena,
      payment_requests: [{ status: "paid", amount: 550 }],
    })
    expect(dluh).toBe(2500)
  })

  it("cena výrobku se v administraci ukáže bez neseného", () => {
    const ulozena = { ...nosna, agreed_total: agreedTotalFor(nosna, 2500) }
    const money = commissionMoney(ulozena, [{ type: "deposit", status: "paid", amount: 550 }])
    expect(money.item_total).toBe(2500)
    expect(money.extras_total).toBe(550)
    expect(money.extras_outstanding).toBe(0)
    expect(money.item_outstanding).toBe(2500)
  })

  it("doprava z pokladny se NEPOČÍTÁ dvakrát", () => {
    /*
     * Objednávka čistě na zakázku s cenou po domluvě a Českou poštou:
     * `original_total` = 0 za kus + 150 poštovné, takže poštovné je v neseném
     * „navíc" a `agreedTotalFor` ho do dluhu přenese samo.
     *
     * Proto se `shipping_total` NEPŘEDPLŇUJE z dopravy objednávky (blok
     * „Domluvená cena" v administraci). Jinak by dluh vyšel 2800 místo 2650 —
     * zákazník by poštovné zaplatil dvakrát. Do `shipping_total` patří jen
     * poštovné, které v pokladně nebylo.
     */
    const pouzeZakazka = {
      id: "po_1",
      stage: "confirmed",
      line_item_id: "li_1",
      line_total: 0,
      original_total: 150,
    }
    const ulozena = {
      ...pouzeZakazka,
      agreed_total: agreedTotalFor(pouzeZakazka, 2500),
    }
    expect(ulozena.agreed_total).toBe(2650)
    expect(productionOutstanding({ ...ulozena, payment_requests: [] })).toBe(2650)
  })

  it("poštovné domluvené teď se přičte k tomu všemu, ne místo toho", () => {
    const ulozena = {
      ...nosna,
      agreed_total: agreedTotalFor(nosna, 2500),
      shipping_total: 150,
    }
    expect(
      productionOutstanding({ ...ulozena, payment_requests: [{ status: "paid", amount: 550 }] })
    ).toBe(2650)
  })
})
