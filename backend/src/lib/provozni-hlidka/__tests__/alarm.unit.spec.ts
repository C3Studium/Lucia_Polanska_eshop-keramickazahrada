import { podpisChyby, textAlarmuChyby } from "../alarm"
import { ciziSluzba, nazevSeSluzbou } from "../sluzba"

/**
 * Alarmy. Dvě pravidla, která se tu hlídají, jsou protichůdná a právě proto
 * se dají snadno pokazit:
 *
 * 1. **Nová chyba se nesmí ztratit.** První verze měla v klíči jen kontrolu
 *    a den, takže když ráno selhala faktura u #68 a odpoledne u #71, druhá
 *    se spolkla — a byla to ta, o které se nevědělo.
 * 2. **Tatáž chyba nesmí přijít stokrát.** Resend dává sto e-mailů denně
 *    a sdílí je s objednávkami zákazníků; od 4. 11. chodí vývojáři jeden
 *    souhrn za 4 hodiny (`fronta.ts`).
 *
 * Rozhoduje o tom podpis: co je „tatáž chyba" a co už „jiná".
 */

describe("podpis chyby", () => {
  it("jiná objednávka je jiná chyba", () => {
    expect(podpisChyby("faktury", "chybí doklad", "order_68")).not.toBe(
      podpisChyby("faktury", "chybí doklad", "order_71")
    )
  })

  it("jiný důvod je jiná chyba", () => {
    expect(podpisChyby("platby", "ComGate vrátil 500")).not.toBe(
      podpisChyby("platby", "ComGate vrátil 401")
    )
  })

  it("tentýž pád je tentýž podpis, i když se liší čísla v textu", () => {
    /* Trvání, port a offset se v textu výjimky mění, aniž by šlo o jinou
       chybu — jinak by jedna rozbitá věc psala každou čtvrthodinu. */
    expect(podpisChyby("uloha", "timeout po 30012 ms")).toBe(
      podpisChyby("uloha", "timeout po 29998 ms")
    )
  })

  it("velikost písmen a mezery nerozhodují", () => {
    expect(podpisChyby("platby", "Spojení Selhalo")).toBe(
      podpisChyby("platby", "spojení   selhalo")
    )
  })

  it("různé okruhy se nesijí, i když mají stejný důvod", () => {
    expect(podpisChyby("faktury", "timeout")).not.toBe(
      podpisChyby("zasilky", "timeout")
    )
  })
})

describe("cizí služba v alarmu", () => {
  it("pozná ComGate, Poštu, iDoklad i Studio", () => {
    expect(ciziSluzba("/hooks/payment/comgate")).toBe("ComGate")
    expect(ciziSluzba("platby", "pp_comgate selhalo")).toBe("ComGate")
    expect(ciziSluzba("job:watch-parcel-tracking")).toBe("Česká pošta")
    expect(ciziSluzba("podání na Balíkovnu selhalo")).toBe("Česká pošta")
    expect(ciziSluzba("/hooks/idoklad")).toBe("iDoklad")
    expect(ciziSluzba("supabase neodpovídá")).toBe("Studio")
  })

  it("bez cizí služby vrátí null — chyba je doma, a to je taky vodítko", () => {
    expect(ciziSluzba("PUT /admin/products/:id", "neplatné pole")).toBeNull()
    expect(ciziSluzba()).toBeNull()
  })

  it("předmět nese službu, jen když je ve hře", () => {
    expect(nazevSeSluzbou("Platby", "ComGate")).toBe("Platby — ComGate")
    expect(nazevSeSluzbou("Platby", null)).toBe("Platby")
  })
})

describe("text alarmu", () => {
  const kdy = new Date("2026-11-03T13:38:00Z")

  it("řekne co selhalo, u které služby a čeho se to týká", () => {
    const text = textAlarmuChyby(
      {
        klic: "faktury",
        nazev: "Faktura · payment.captured",
        zprava: "iDoklad vrátil 400: neplatné IČO odběratele",
        detail: ["order_68", "idoklad_invoice_error nastaveno"],
        cehoSeTyka: { typ: "order", id: "order_68" },
      },
      "iDoklad",
      kdy
    )

    expect(text).toContain("Co selhalo: Faktura · payment.captured")
    expect(text).toContain("Cizí služba: iDoklad")
    expect(text).toContain("Týká se: order order_68")
    expect(text).toContain("neplatné IČO odběratele")
    expect(text).toContain("3. 11. 2026")
  })

  it("neslibuje e-mail hned a neodkazuje do logu", () => {
    const text = textAlarmuChyby(
      { klic: "platby", nazev: "Platby", zprava: "rozbité" },
      null,
      kdy
    )
    /* Text jde do souhrnu po 4 hodinách — patička je tam jen jednou. */
    expect(text).not.toContain("hned")
    expect(text).not.toMatch(/log(u|y)? serveru/i)
  })
})
