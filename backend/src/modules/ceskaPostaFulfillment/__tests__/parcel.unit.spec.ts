/**
 * Skládání podání zásilky.
 *
 * Testy míří hlavně na tři místa, kde chyba není vidět — zásilka odejde, ČP
 * ji přijme, a špatně je až doručení:
 *
 * 1. Balíkovna adresovaná domů zákazníkovi místo na výdejnu.
 * 2. PSČ vzaté z `point.address` (městská část) místo z `point.zip` (výdejna).
 * 3. Dobírka bez variabilního symbolu — peníze dorazí nespárované.
 */

import {
  adresaPrijemce,
  chybaZOdpovedi,
  normalizujPsc,
  normalizujTelefon,
  popisChyb,
  prectiOdpoved,
  rozdelAdresu,
  sestavPodani,
  sluzbyProZasilku,
  variabilniSymbol,
  type VstupPodani,
} from "../parcel"

const ODESILATEL = { customerId: "U124", postCode: "10003", locationNumber: 627 }

const zakladni = (prepsat: Partial<VstupPodani> = {}): VstupPodani => ({
  serviceCode: "DR",
  vaha: 1.5,
  prijemce: {
    first_name: "Jan",
    last_name: "Novák",
    address_1: "Hasičská 551/52",
    city: "Ostrava",
    postal_code: "700 30",
    phone: "603 123 456",
  },
  email: "jan.novak@email.cz",
  odesilatel: ODESILATEL,
  sluzby: [],
  datum: "2026-09-23",
  ...prepsat,
})

describe("rozpad české adresy", () => {
  it("rozdělí číslo popisné a orientační", () => {
    expect(rozdelAdresu("Hasičská 551/52")).toEqual({
      street: "Hasičská",
      houseNumber: "551",
      sequenceNumber: "52",
    })
  })

  it("zvládne adresu jen s jedním číslem", () => {
    expect(rozdelAdresu("V olšinách 123")).toEqual({
      street: "V olšinách",
      houseNumber: "123",
    })
  })

  it("nechá písmeno u čísla být", () => {
    expect(rozdelAdresu("Nábřeží 12a")).toEqual({ street: "Nábřeží", houseNumber: "12a" })
    expect(rozdelAdresu("Dlouhá 5/7b")).toEqual({
      street: "Dlouhá",
      houseNumber: "5",
      sequenceNumber: "7b",
    })
  })

  it("nespolkne číslici, která patří do názvu ulice", () => {
    /* „5. května 12" — pětka je součást názvu, dvanáctka je číslo domu. */
    expect(rozdelAdresu("5. května 12")).toEqual({ street: "5. května", houseNumber: "12" })
  })

  it("bez čísla vrátí celý řetězec jako ulici a čísla vynechá", () => {
    /*
     * Raději podání odmítnuté ČP než číslo uhádnuté z názvu ulice — druhé
     * pošle zásilku na existující, ale cizí adresu.
     */
    expect(rozdelAdresu("Balíkovna")).toEqual({ street: "Balíkovna" })
    expect(rozdelAdresu("Náměstí Míru")).toEqual({ street: "Náměstí Míru" })
  })

  it("snese prázdný vstup", () => {
    expect(rozdelAdresu("")).toEqual({ street: "" })
    expect(rozdelAdresu(null)).toEqual({ street: "" })
    expect(rozdelAdresu(undefined)).toEqual({ street: "" })
  })

  it("srovná přebytečné mezery a čárku před číslem", () => {
    expect(rozdelAdresu("  Dlouhá   5/7  ")).toEqual({
      street: "Dlouhá",
      houseNumber: "5",
      sequenceNumber: "7",
    })
    expect(rozdelAdresu("Dlouhá, 5")).toEqual({ street: "Dlouhá", houseNumber: "5" })
  })
})

describe("PSČ a telefon", () => {
  it("PSČ bez mezer", () => {
    expect(normalizujPsc("700 30")).toBe("70030")
    expect(normalizujPsc("70030")).toBe("70030")
  })

  it("telefon do mezinárodního tvaru", () => {
    expect(normalizujTelefon("603 123 456")).toBe("+420603123456")
    expect(normalizujTelefon("+420 603 123 456")).toBe("+420603123456")
    expect(normalizujTelefon("00420603123456")).toBe("+420603123456")
    expect(normalizujTelefon("")).toBeUndefined()
    expect(normalizujTelefon(null)).toBeUndefined()
  })
})

describe("adresa příjemce podle služby", () => {
  it("Balíkovna jde na výdejnu, ne na adresu zákazníka", () => {
    const adresa = adresaPrijemce(
      zakladni({ serviceCode: "NB", vydejna: { zip: "10000", name: "Praha 10" } })
    )

    expect(adresa).toEqual({ street: "Balíkovna", zipCode: "10000" })
    /* Zákazníkova ulice ani město se nesmí do zásilky dostat vůbec. */
    expect(JSON.stringify(adresa)).not.toContain("Hasičská")
    expect(JSON.stringify(adresa)).not.toContain("Ostrava")
    expect(JSON.stringify(adresa)).not.toContain("70030")
  })

  it("Balíkovna bez vybrané výdejny podání odmítne", () => {
    /*
     * Tohle musí spadnout hlasitě. Zásilka NB bez PSČ výdejny by se buď
     * odmítla u ČP, nebo — hůř — doručila na PSČ, které tam zbylo odjinud.
     */
    expect(() => adresaPrijemce(zakladni({ serviceCode: "NB", vydejna: null }))).toThrow(
      /Balíkovny nemá vybranou výdejnu/
    )
  })

  it("na adresu použije rozpad ulice, město a PSČ", () => {
    expect(adresaPrijemce(zakladni())).toEqual({
      street: "Hasičská",
      houseNumber: "551",
      sequenceNumber: "52",
      city: "Ostrava",
      zipCode: "70030",
    })
  })
})

describe("celé tělo podání", () => {
  it("hlavička nese všechny tři identifikátory odesílatele", () => {
    const telo: any = sestavPodani(zakladni())
    expect(telo.parcelServiceHeader.parcelServiceHeaderCom).toEqual({
      transmissionDate: "2026-09-23",
      customerID: "U124",
      postCode: "10003",
      locationNumber: 627,
    })
  })

  it("váha jde jako řetězec a měna je CZK", () => {
    const telo: any = sestavPodani(zakladni())
    expect(telo.parcelServiceData.parcelParams.weight).toBe("1.5")
    expect(telo.parcelServiceData.parcelParams.currency).toBe("CZK")
  })

  it("prefix zásilky je kód služby", () => {
    expect((sestavPodani(zakladni()) as any).parcelServiceData.parcelParams.prefixParcelCode).toBe(
      "DR"
    )
    expect(
      (
        sestavPodani(
          zakladni({ serviceCode: "NB", vydejna: { zip: "10000", name: "Praha 10" } })
        ) as any
      ).parcelServiceData.parcelParams.prefixParcelCode
    ).toBe("NB")
  })

  it("dobírka přidá částku i variabilní symbol", () => {
    const telo: any = sestavPodani(
      zakladni({ dobirka: { castka: 1250, variabilniSymbol: "20260042" } })
    )
    expect(telo.parcelServiceData.parcelParams.amount).toBe(1250)
    expect(telo.parcelServiceData.parcelParams.vsVoucher).toBe("20260042")
  })

  it("bez dobírky se částka ani VS neposílají", () => {
    /*
     * Ne `amount: 0` — nula je u ČP platná částka a znamenala by dobírku na
     * nula korun, tedy zásilku, kterou pošta bude chtít proplatit.
     */
    const params: any = (sestavPodani(zakladni()) as any).parcelServiceData.parcelParams
    expect(params).not.toHaveProperty("amount")
    expect(params).not.toHaveProperty("vsVoucher")
  })

  it("udaná cena se posílá vždy a zaokrouhluje", () => {
    /*
     * Není volitelná: podání bez `insuredValue` ČP odmítne s
     * `336 MISSING_REQUIRED_PRICE`. Změřeno.
     */
    expect(
      (sestavPodani(zakladni({ udanaCena: 1499.6 })) as any).parcelServiceData.parcelParams
        .insuredValue
    ).toBe(1500)
  })

  it("u nulové objednávky pošle aspoň korunu, ne nulu", () => {
    /* Nula je pro ČP neplatná cena (`105 INVALID_PRICE`). */
    for (const cena of [0, null, undefined]) {
      expect(
        (sestavPodani(zakladni({ udanaCena: cena as any })) as any).parcelServiceData.parcelParams
          .insuredValue
      ).toBe(1)
    }
  })

  it("firma vytlačí jméno a příjmení, ne naopak", () => {
    const telo: any = sestavPodani(
      zakladni({ prijemce: { ...zakladni().prijemce, company: "Keramická zahrada s.r.o." } })
    )
    expect(telo.parcelServiceData.parcelAddress.companyName).toBe("Keramická zahrada s.r.o.")
    expect(telo.parcelServiceData.parcelAddress).not.toHaveProperty("firstName")
    expect(telo.parcelServiceData.parcelAddress).not.toHaveProperty("surname")
  })

  it("bez firmy jde jméno a příjmení", () => {
    const adresa: any = (sestavPodani(zakladni()) as any).parcelServiceData.parcelAddress
    expect(adresa.firstName).toBe("Jan")
    expect(adresa.surname).toBe("Novák")
  })

  it("e-mail a telefon se přikládají normalizované", () => {
    const adresa: any = (sestavPodani(zakladni()) as any).parcelServiceData.parcelAddress
    expect(adresa.emailAddress).toBe("jan.novak@email.cz")
    expect(adresa.mobilNumber).toBe("+420603123456")
  })

  it("chybějící e-mail nebo telefon se vynechá, neposílá se prázdný", () => {
    const telo: any = sestavPodani(
      zakladni({ email: null, prijemce: { ...zakladni().prijemce, phone: null } })
    )
    expect(telo.parcelServiceData.parcelAddress).not.toHaveProperty("emailAddress")
    expect(telo.parcelServiceData.parcelAddress).not.toHaveProperty("mobilNumber")
  })

  it("doplňkové služby se předávají beze změny", () => {
    expect(
      (sestavPodani(zakladni({ sluzby: ["7", "M"] })) as any).parcelServiceData.parcelServices
    ).toEqual(["7", "M"])
  })
})

describe("výběr doplňkových služeb", () => {
  it("křehké se u Balíkovny neobjednává — číselník ČP ho tam nemá", () => {
    /*
     * Tohle je nejdůležitější test v souboru. Keramika je křehká, takže sáhnout
     * po službě 11 je přirozené — jenže u NB ji podací pošta odmítne chybou 42
     * a zjistí se to, až bude balík zabalený.
     */
    expect(sluzbyProZasilku({ serviceCode: "NB", krehke: true })).not.toContain("11")
  })

  it("na adresu se křehké objedná", () => {
    expect(sluzbyProZasilku({ serviceCode: "DR", krehke: true })).toContain("11")
  })

  it("udaná cena je vždy, u obou služeb", () => {
    /* Bez ní `336 MISSING_REQUIRED_PRICE` — změřeno, není to volba. */
    expect(sluzbyProZasilku({ serviceCode: "NB" })).toContain("7")
    expect(sluzbyProZasilku({ serviceCode: "DR" })).toContain("7")
  })

  it("dobírka je bezdokladová, tedy 41", () => {
    expect(sluzbyProZasilku({ serviceCode: "NB", maDobirku: true })).toContain("41")
  })

  it("velikostní třída jen u zásilek na adresu", () => {
    /*
     * `DR` bez ní vrátí `261 MISSING_SIZE_CATEGORY`; `NB` s pouhým ["7"]
     * prošla. Obojí změřeno proti testovacímu prostředí.
     */
    expect(sluzbyProZasilku({ serviceCode: "DR" })).toContain("M")
    expect(sluzbyProZasilku({ serviceCode: "DR", velikost: "XL" })).toContain("XL")

    const balikovna = sluzbyProZasilku({ serviceCode: "NB", velikost: "XL" })
    for (const velikost of ["S", "M", "L", "XL"]) {
      expect(balikovna).not.toContain(velikost)
    }
  })

  it("nikdy nepošle prázdný seznam", () => {
    /* Prázdné pole ČP odmítne rovnou: „Array is too short: must have at least 1". */
    for (const serviceCode of ["NB", "DR"] as const) {
      expect(sluzbyProZasilku({ serviceCode }).length).toBeGreaterThan(0)
    }
  })
})

describe("variabilní symbol dobírky", () => {
  it("je numerický a přesně desetimístný", () => {
    /* Kratší než 10 míst je chyba 17 a zásilku to shodí. */
    expect(variabilniSymbol(42)).toBe("0000000042")
    expect(variabilniSymbol("1234")).toBe("0000001234")
    expect(variabilniSymbol(42)).toHaveLength(10)
    expect(variabilniSymbol(42)).toMatch(/^\d{10}$/)
  })

  it("z různých objednávek dá různé symboly", () => {
    /* Duplicita je chyba 18. */
    expect(variabilniSymbol(1)).not.toBe(variabilniSymbol(2))
  })

  it("bez číslic v čísle objednávky se ozve, místo aby poslal nuly", () => {
    expect(() => variabilniSymbol("abc")).toThrow(/variabilní symbol/)
  })
})

describe("kontakt na adresáta u Balíkovny", () => {
  const doBalikovny = (prepsat: Partial<VstupPodani>) =>
    sestavPodani(
      zakladni({ serviceCode: "NB", vydejna: { zip: "10109", name: "Praha 10" }, ...prepsat })
    )

  it("stačí e-mail", () => {
    expect(() =>
      doBalikovny({ prijemce: { ...zakladni().prijemce, phone: null } })
    ).not.toThrow()
  })

  it("stačí telefon", () => {
    expect(() => doBalikovny({ email: null })).not.toThrow()
  })

  it("bez obojího podání odmítne", () => {
    /*
     * Zásilka by na výdejně ležela, dokud nevyprší lhůta, a vrátila se zpět —
     * zákazník by se o ní nedozvěděl.
     */
    expect(() =>
      doBalikovny({ email: null, prijemce: { ...zakladni().prijemce, phone: null } })
    ).toThrow(/telefon nebo e-mail/)
  })

  it("na adresu kontakt povinný není", () => {
    expect(() =>
      sestavPodani(zakladni({ email: null, prijemce: { ...zakladni().prijemce, phone: null } }))
    ).not.toThrow()
  })
})

describe("čtení odpovědi", () => {
  /* Obě odpovědi jsou doslovně zachycené z testovacího prostředí ČP. */

  const prijato = {
    responseHeader: {
      resultHeader: { responseCode: 1, responseText: "OK" },
      resultParcelData: [
        {
          recordNumber: "1",
          parcelCode: "NB1249224595U",
          parcelStateResponse: [{ responseCode: 1, responseText: "OK" }],
        },
      ],
      responsePrintParams: { file: "JVBERi0xLjQK" },
    },
  }

  const odmitnuto = {
    responseHeader: {
      resultHeader: { responseCode: 19, responseText: "BATCH_INVALID" },
      resultParcelData: [
        {
          recordNumber: "1",
          parcelCode: "",
          parcelStateResponse: [
            { responseCode: 408, responseText: "INFO_ADDRESS_WAS_MODIFIED" },
            { responseCode: 261, responseText: "MISSING_SIZE_CATEGORY" },
            { responseCode: 429, responseText: "INFO_NOTIFICIATON_WAS_MODIFIED" },
          ],
        },
      ],
      responsePrintParams: {},
    },
  }

  it("přijatou zásilku pozná podle čísla a kódu 1", () => {
    expect(prectiOdpoved(prijato)).toEqual({
      ok: true,
      cisloZasilky: "NB1249224595U",
      stitekBase64: "JVBERi0xLjQK",
      chyby: [],
    })
  })

  it("BATCH_INVALID NENÍ úspěch, i když přišel s HTTP 200", () => {
    /*
     * Nejdůležitější test v souboru. Tahle odpověď má stavový kód 200 a
     * obsluze by jinak oznámila odeslání zásilky, která nikdy nevznikla.
     */
    const vysledek = prectiOdpoved(odmitnuto)
    expect(vysledek.ok).toBe(false)
    expect(vysledek.cisloZasilky).toBeUndefined()
    expect(vysledek.chyby).toEqual(["261 MISSING_SIZE_CATEGORY"])
  })

  it("stavy INFO_* se mezi chyby nepočítají", () => {
    /* ČP jimi jen hlásí, že si adresu nebo avízo sama upravila. */
    expect(prectiOdpoved(odmitnuto).chyby).not.toContain("408 INFO_ADDRESS_WAS_MODIFIED")
    expect(prectiOdpoved(prijato).chyby).toEqual([])
  })

  it("odmítnutí bez podrobností se neztratí", () => {
    const vysledek = prectiOdpoved({
      responseHeader: {
        resultHeader: { responseCode: 19, responseText: "BATCH_INVALID" },
        resultParcelData: [{ parcelCode: "" }],
      },
    })
    expect(vysledek.ok).toBe(false)
    expect(vysledek.chyby).toEqual(["19 BATCH_INVALID"])
  })

  it("z prázdné odpovědi nic nevymyslí", () => {
    expect(prectiOdpoved({}).ok).toBe(false)
    expect(prectiOdpoved(null).ok).toBe(false)
  })
})

describe("vysvětlení chybových kódů", () => {
  it("k 247 dodá, že testovací prostředí skutečné výdejny nezná", () => {
    /*
     * Tohle je kód, na který zítřejší testování narazí jako první — a bez
     * vysvětlení vypadá jako chyba v adrese zákazníka.
     */
    const popis = popisChyb(["247 INVALID_ADDRESS"])
    expect(popis).toContain("247 INVALID_ADDRESS")
    expect(popis).toContain("testovacím prostředí")
  })

  it("neznámý kód projde beze změny, místo aby zmizel", () => {
    expect(popisChyb(["999 NECO_NOVEHO"])).toBe("999 NECO_NOVEHO")
  })

  it("víc chyb spojí do jedné věty", () => {
    expect(popisChyb(["261 MISSING_SIZE_CATEGORY", "336 MISSING_REQUIRED_PRICE"])).toContain("; ")
  })
})

describe("chybová hláška", () => {
  it("vytáhne zprávy z pole chyb", () => {
    const telo = [{ code: -5, status: "400", message: "No API path found that matches request" }]
    expect(chybaZOdpovedi(400, telo, JSON.stringify(telo))).toBe(
      "HTTP 400: No API path found that matches request"
    )
  })

  it("spojí víc chyb dohromady", () => {
    const telo = [{ message: "První" }, { message: "Druhá" }]
    expect(chybaZOdpovedi(400, telo, "")).toBe("HTTP 400: První; Druhá")
  })

  it("u nerozpoznaného tvaru ukáže syrovou odpověď, ne prázdno", () => {
    expect(chybaZOdpovedi(500, null, "<html>Internal Server Error</html>")).toContain(
      "Internal Server Error"
    )
  })
})
