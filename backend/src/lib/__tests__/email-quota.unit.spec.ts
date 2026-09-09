/**
 * Poslední zpráva denního stropu patří varování majitelce.
 *
 * Vzniklo z toho, co se stalo 9. 9. 2026: noční upomínky na opuštěné košíky
 * vyčerpaly celý denní strop Resendu a potvrzení objednávky pak nemělo z čeho
 * odejít — v administraci jen přibyly řádky „Nepodařilo se" a nikdo se
 * nedozvěděl proč.
 */
import {
  denKvoty,
  novyStav,
  proDen,
  rozhodniOKvote,
  textVarovani,
} from "../email-quota"

const stav = (odeslano: number, varovaniOdeslano = false) => ({
  den: "2026-09-09",
  odeslano,
  varovaniOdeslano,
})

describe("denní strop odesílání", () => {
  it("den se počítá v UTC, ne v místním čase", () => {
    // 23:30 v Praze je 21:30 UTC téhož dne; 00:30 v Praze je 22:30 UTC dne
    // předchozího. Resend se řídí UTC, takže musí i tohle.
    expect(denKvoty(new Date("2026-09-09T21:30:00Z"))).toBe("2026-09-09")
    expect(denKvoty(new Date("2026-09-09T22:30:00Z"))).toBe("2026-09-09")
    expect(denKvoty(new Date("2026-09-10T00:30:00Z"))).toBe("2026-09-10")
  })

  it("pod stropem se posílá normálně", () => {
    expect(rozhodniOKvote(stav(0), 100, false)).toBe("posli")
    expect(rozhodniOKvote(stav(50), 100, false)).toBe("posli")
    expect(rozhodniOKvote(stav(98), 100, false)).toBe("posli")
  })

  it("na posledním kusu stropu se místo zákazníka pošle varování", () => {
    expect(rozhodniOKvote(stav(99), 100, false)).toBe("posliVarovani")
  })

  it("po odeslaném varování se už dnes neposílá nic", () => {
    expect(rozhodniOKvote(stav(99, true), 100, false)).toBe("zastav")
    expect(rozhodniOKvote(stav(120, true), 100, false)).toBe("zastav")
  })

  it("samo varování projde vždycky — jinak by se nemělo jak dostat ven", () => {
    expect(rozhodniOKvote(stav(99), 100, true)).toBe("posli")
    expect(rozhodniOKvote(stav(500, true), 100, true)).toBe("posli")
  })

  it("nulový nebo nesmyslný strop hlídání vypíná", () => {
    expect(rozhodniOKvote(stav(1000), 0, false)).toBe("posli")
    expect(rozhodniOKvote(stav(1000), -5, false)).toBe("posli")
    expect(rozhodniOKvote(stav(1000), Number.NaN, false)).toBe("posli")
  })

  it("počítadlo se překlopením dne vynuluje", () => {
    const vcera = { den: "2026-09-09", odeslano: 100, varovaniOdeslano: true }
    const dnes = proDen(vcera, new Date("2026-09-10T00:00:01Z"))

    expect(dnes.den).toBe("2026-09-10")
    expect(dnes.odeslano).toBe(0)
    expect(dnes.varovaniOdeslano).toBe(false)
  })

  it("ve stejném dni zůstává počítadlo netknuté", () => {
    const puvodni = stav(42)
    expect(proDen(puvodni, new Date("2026-09-09T23:59:59Z"))).toBe(puvodni)
  })

  it("nový stav začíná na nule", () => {
    const s = novyStav(new Date("2026-09-09T10:00:00Z"))
    expect(s).toEqual({ den: "2026-09-09", odeslano: 0, varovaniOdeslano: false })
  })

  it("varování říká co se stalo, co to znamená a co s tím", () => {
    const t = textVarovani(100, "2026-09-09")

    expect(t.predmet).toContain("limit")
    // Číslo stropu i den, ať se nemusí dohledávat.
    expect(t.popis).toContain("100")
    expect(t.popis).toContain("2026-09-09")
    // Důsledek pro zákazníka.
    expect(t.popis).toMatch(/potvrzení objednávek/i)
    // A cesta ven.
    expect(t.popis).toMatch(/půlnoc|tarif/i)
  })
})
