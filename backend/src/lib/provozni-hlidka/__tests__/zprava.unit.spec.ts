import {
  denPrahy,
  klicAlarmu,
  klicSouhrnu,
  predmetSouhrnu,
  rozdel,
  textAlarmu,
  textSouhrnu,
  vecNefunguje,
} from "../zprava"
import type { VysledekKontroly } from "../typy"

/**
 * Texty hlídky. Na obsahu alarmu záleží nejvíc a naživo se zkouší nejhůř —
 * e-mail přijde v okamžiku, kdy je něco rozbité, a to je špatná chvíle na
 * zjištění, že v něm chybí číslo objednávky.
 */

const ok = (nazev: string): VysledekKontroly => ({
  klic: nazev,
  nazev,
  stav: "ok",
  zprava: "v pořádku",
})

const chyba = (nazev: string, detail?: string[]): VysledekKontroly => ({
  klic: nazev,
  nazev,
  stav: "chyba",
  zprava: "rozbité",
  detail,
})

describe("klíče hlídky", () => {
  it("alarm má v klíči den, takže jedna chyba píše jednou denně", () => {
    const rano = new Date("2026-11-03T06:00:00Z")
    const vecer = new Date("2026-11-03T19:00:00Z")
    expect(klicAlarmu("faktury", rano)).toBe(klicAlarmu("faktury", vecer))
    expect(klicAlarmu("faktury", new Date("2026-11-04T06:00:00Z"))).not.toBe(
      klicAlarmu("faktury", rano)
    )
  })

  it("den se bere pražský, ne podle UTC", () => {
    /* 23:30 v Praze je ještě 3. 11., i když v UTC je 22:30 téhož dne;
       o půlnoci v Praze (23:00 UTC) už musí být 4. 11. */
    expect(denPrahy(new Date("2026-11-03T22:30:00Z"))).toBe("2026-11-03")
    expect(denPrahy(new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-04")
  })

  it("souhrn a alarm si klíče nepletou", () => {
    const kdy = new Date("2026-11-03T19:00:00Z")
    expect(klicSouhrnu(kdy)).not.toBe(klicAlarmu("souhrn", kdy))
  })
})

describe("alarm", () => {
  const kdy = new Date("2026-11-03T13:38:00Z")

  it("nese přesné podrobnosti, ne odkaz do logu", () => {
    const text = textAlarmu(
      chyba("Faktury v iDokladu", [
        "#68 · zachyceno 1125 · v metadatech není doklad ani chyba",
      ]),
      kdy
    )

    expect(text).toContain("Faktury v iDokladu")
    expect(text).toContain("#68")
    expect(text).toContain("v metadatech není doklad ani chyba")
    expect(text).not.toMatch(/log(u|y)? serveru/i)
  })

  it("řekne, že se bude opakovat jednou denně", () => {
    expect(textAlarmu(chyba("Platby"), kdy)).toContain("jednou denně")
  })

  it("předmět pozná rozbitou věc podle názvu", () => {
    expect(textAlarmu(chyba("Platby"), kdy)).toContain("Kontrola: Platby")
  })
})

describe("denní souhrn", () => {
  const kdy = new Date("2026-11-03T20:00:00Z")

  it("bez chyb řekne, že všechno funguje, a vyjmenuje kontroly", () => {
    const text = textSouhrnu([ok("Platby"), ok("Faktury")], kdy)
    expect(predmetSouhrnu([ok("Platby")], kdy)).toContain("všechno funguje")
    expect(text).toContain("Dnes neselhalo nic")
    expect(text).toContain("✓ Platby")
    expect(text).toContain("✓ Faktury")
  })

  it("rozbitou kontrolu nikdy nevydává za v pořádku", () => {
    const vysledky = [ok("Platby"), chyba("Faktury", ["#68"])]
    const text = textSouhrnu(vysledky, kdy)

    expect(text).not.toContain("Dnes neselhalo nic")
    expect(text).toContain("✗ Faktury")
    expect(text).toContain("#68")
    expect(predmetSouhrnu(vysledky, kdy)).toContain("1 věc nefunguje")
  })

  it("nenastavené kontroly nejsou chyba, ale v souhrnu jsou", () => {
    const vysledky: VysledekKontroly[] = [
      ok("Platby"),
      {
        klic: "obchod",
        nazev: "Obchod (web)",
        stav: "nenastaveno",
        zprava: "chybí adresa",
      },
    ]

    expect(predmetSouhrnu(vysledky, kdy)).toContain("všechno funguje")
    expect(textSouhrnu(vysledky, kdy)).toContain("Nekontroluje se")
    expect(rozdel(vysledky).chyby).toHaveLength(0)
  })
})

describe("skloňování počtu", () => {
  it("jde přes jednotné, množné i genitiv", () => {
    expect(vecNefunguje(1)).toBe("1 věc nefunguje")
    expect(vecNefunguje(2)).toBe("2 věci nefungují")
    expect(vecNefunguje(4)).toBe("4 věci nefungují")
    expect(vecNefunguje(5)).toBe("5 věcí nefunguje")
  })
})
