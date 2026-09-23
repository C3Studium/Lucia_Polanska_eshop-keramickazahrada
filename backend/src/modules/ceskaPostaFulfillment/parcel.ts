/**
 * Sestavení podání zásilky pro `POST /ZSKService/v1/parcelService`.
 *
 * Všechno tady je čistá funkce nad prostými daty — žádná síť, žádný container.
 * Je to schválně: payload je jediné místo, kde se dá udělat chyba, kterou
 * Česká pošta ohlásí jako `400` s větou o poli, které v naší terminologii
 * neexistuje. Testovat se to musí bez volání, protože testovací prostředí ČP
 * je sdílené a každé podání v něm po sobě něco nechává.
 *
 * Tvar payloadu je opsaný z odpovědi, kterou server **přijal** 22. 9. 2026
 * (vrátil `parcelCode: NB1249224431U` a PDF štítek) — ne z dokumentace.
 */

/** Služby, jak je pojmenovává ČP. `NB` = Do Balíkovny, `DR` = na adresu. */
export type KodSluzby = "NB" | "DR"

/**
 * Příjemce tak, jak vypadá `order.shipping_address` v Meduse — ne jak ho
 * pojmenovává ČP. Překlad názvů polí je práce `sestavPodani`, aby se
 * nemíchal se čtením objednávky.
 */
export type Prijemce = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  /** Ulice včetně čísla, tak jak ji storefront ukládá do `address_1`. */
  address_1?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
}

export type VydejnaBalikovny = {
  zip: string
  name: string
}

export type NastaveniOdesilatele = {
  customerId: string
  postCode: string
  locationNumber: number
}

export type VstupPodani = {
  serviceCode: KodSluzby
  vaha: number
  prijemce: Prijemce
  email?: string | null
  vydejna?: VydejnaBalikovny | null
  /** Dobírka: částka v Kč a variabilní symbol. `null` = bez dobírky. */
  dobirka?: { castka: number; variabilniSymbol: string } | null
  /** Udaná cena zásilky v Kč — ČP ji chce i bez připojištění. */
  udanaCena?: number | null
  odesilatel: NastaveniOdesilatele
  /** Doplňkové služby. Viz `sluzbyProZasilku`. */
  sluzby: string[]
  /** Kvůli testovatelnosti — jinak dnešní datum. */
  datum?: string
}

/**
 * Doplňkové služby, jak je očísloval číselník ČP (Technická dokumentace,
 * Příloha č. 2, verze 1.1.2025).
 *
 * V OpenAPI specifikaci `parcelServices` žádný enum nemá — je to prosté pole
 * řetězců. Spec tedy **kód nikdy nezvaliduje** a `HTTP 200` neznamená, že je
 * služba u dané zásilky přípustná: chyby `22` („pro dané PSČ adresáta není
 * služba povolena") a `42` („zadání nepovolené služby") vzniknou až při
 * nahrávání datového souboru na podací poště. Tenhle soubor je proto jediná
 * kontrola, která existuje.
 */
export const SLUZBY = {
  /** Udaná cena. Váže se na `insuredValue` — bez něj je to placená služba bez částky. */
  udanaCena: "7",
  /** Křehce. Pro Balíkovnu (NB) **není** v číselníku — viz `sluzbyProZasilku`. */
  krehce: "11",
  /** Bezdokladová dobírka na účet podavatele. Vyžaduje `amount` + `vsVoucher` + `weight`. */
  dobirka: "41",
} as const

/** Velikostní kategorie zásilky. U zásilek na adresu ji ČP vyžaduje. */
export type VelikostZasilky = "S" | "M" | "L" | "XL"

/**
 * Které služby k téhle zásilce.
 *
 * Všechno níže je **změřené proti testovacímu prostředí**, ne odvozené — a na
 * dvou místech to vyšlo jinak, než jak to čte číselník.
 *
 * **Udaná cena (`7`) je povinná u každé zásilky.** Ne volitelné připojištění,
 * jak se dá z názvu čekat: podání jen s dobírkou vrátí
 * `336 MISSING_REQUIRED_PRICE` a `105 INVALID_PRICE`. Bez `insuredValue`
 * neprojde ani Balíkovna, ani zásilka na adresu.
 *
 * **Velikostní kategorie je povinná u `DR`, ne u `NB`.** `DR` bez ní vrátí
 * `261 MISSING_SIZE_CATEGORY`; `NB` s pouhým `["7"]` prošla. Přijaté jsou
 * `S`, `M`, `L` i `XL`.
 *
 * **„Křehce" (`11`) u Balíkovny nAPI přijalo**, přestože ho číselník ČP
 * u `NB` neuvádí. Posílá se přesto jen u zásilek na adresu: kódy `22` a `42`
 * („nepovolená služba") kontroluje až podací pošta při nahrávání dávky, takže
 * to `1 OK` z nAPI nic negarantuje. Rozdíl mezi opatrností a odmítnutým
 * balíkem je tady jedna otázka na obchodního zástupce ČP — do té doby platí
 * číselník.
 */
export const sluzbyProZasilku = (vstup: {
  serviceCode: KodSluzby
  krehke?: boolean
  maDobirku?: boolean
  velikost?: VelikostZasilky
}): string[] => {
  /* Vždycky — bez udané ceny ČP zásilku odmítne, ať je jakákoli. */
  const sluzby: string[] = [SLUZBY.udanaCena]

  if (vstup.serviceCode === "DR") {
    sluzby.push(vstup.velikost ?? "M")
    /* Křehce jen na adresu — viz hlavička. */
    if (vstup.krehke) sluzby.push(SLUZBY.krehce)
  }

  if (vstup.maDobirku) sluzby.push(SLUZBY.dobirka)

  return sluzby
}

/**
 * Variabilní symbol dobírkové poukázky z čísla objednávky.
 *
 * ČP vyžaduje **numerický údaj na 10 míst** (jinak chyba 17) a **unikátní**
 * napříč podáními (chyba 18 na duplicitu). Číslo objednávky obojí splňuje —
 * je unikátní z podstaty a doplní se nulami zleva.
 *
 * Podle tohohle symbolu se přijatá dobírka páruje s objednávkou. Bez něj
 * přijdou peníze na účet bez identifikace a spárovat je zpětně znamená projít
 * výpis ručně.
 */
export const variabilniSymbol = (displayId: number | string): string => {
  const cislice = String(displayId).replace(/\D/g, "")
  if (!cislice) {
    throw new Error(`Z čísla objednávky „${displayId}" nelze sestavit variabilní symbol.`)
  }
  return cislice.padStart(10, "0").slice(-10)
}

export type RozpadAdresy = {
  street: string
  houseNumber?: string
  sequenceNumber?: string
}

/**
 * Rozpad české adresy na ulici a čísla.
 *
 * ČP chce `street`, `houseNumber` (číslo popisné) a `sequenceNumber` (číslo
 * orientační) zvlášť, ale storefront sbírá jednu kolonku „Ulice a číslo
 * popisné" — rozdělit se to tedy musí tady.
 *
 * Tvary, které tím projdou, jsou ty, které lidi opravdu píšou:
 *
 * | zápis              | street      | houseNumber | sequenceNumber |
 * | ------------------ | ----------- | ----------- | -------------- |
 * | `Hasičská 551/52`  | Hasičská    | 551         | 52             |
 * | `V olšinách 123`   | V olšinách  | 123         | —              |
 * | `Dlouhá 5/7b`      | Dlouhá      | 5           | 7b             |
 * | `Nábřeží 12a`      | Nábřeží     | 12a         | —              |
 * | `Balíkovna`        | Balíkovna   | —           | —              |
 *
 * Když se číslo najít nedá, vrací se celý řetězec jako `street` a čísla se
 * vynechají. To je záměr: raději ať ČP odmítne podání s chybějícím číslem, než
 * aby zásilka odešla s číslem uhádnutým z kusu názvu ulice.
 */
export const rozdelAdresu = (adresa: string | null | undefined): RozpadAdresy => {
  const cely = String(adresa ?? "").trim().replace(/\s+/g, " ")
  if (!cely) return { street: "" }

  /* Číslo je až na konci: ulice může sama obsahovat číslici („5. května"). */
  const shoda = cely.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)(?:\s*\/\s*(\d+[a-zA-Z]?))?$/)
  if (!shoda) return { street: cely }

  const [, ulice, prvni, druhe] = shoda
  if (!ulice.trim()) return { street: cely }

  return {
    street: ulice.trim().replace(/[,\s]+$/, ""),
    houseNumber: prvni,
    ...(druhe ? { sequenceNumber: druhe } : {}),
  }
}

/** PSČ bez mezer — ČP je chce jako pět číslic v jednom kuse. */
export const normalizujPsc = (psc: string | null | undefined): string =>
  String(psc ?? "").replace(/\s+/g, "")

/**
 * Telefon v mezinárodním tvaru.
 *
 * Storefront nechává zákazníka napsat cokoli. `+420 603 123 456`,
 * `603123456` i `00420603123456` jsou totéž číslo a ČP bere jen ten první
 * tvar. Bez předvolby se doplní česká — zásilky jdou jen do ČR (`DOBIRKA_COUNTRIES`),
 * takže to není domněnka, ale daná podmínka.
 */
export const normalizujTelefon = (telefon: string | null | undefined): string | undefined => {
  const cisla = String(telefon ?? "").replace(/[^\d+]/g, "")
  if (!cisla) return undefined
  if (cisla.startsWith("+")) return cisla
  if (cisla.startsWith("00")) return `+${cisla.slice(2)}`
  if (cisla.length === 9) return `+420${cisla}`
  return `+${cisla}`
}

/**
 * Adresa příjemce podle služby.
 *
 * U Balíkovny se **neposílá adresa zákazníka**, ale výdejny: `street` je
 * doslova „Balíkovna" a `zipCode` je kód výdejního místa. Zákazníkova vlastní
 * adresa by zásilku poslala k němu domů za cenu Balíkovny. Ostatní adresní
 * pole zůstávají prázdná, jak to FAQ ČP výslovně doporučuje.
 *
 * ## Proč `point.zip` a ne `point.id`
 *
 * FAQ ČP říká, že do `zipCode` patří „ID konkrétní Balíkovny" a že jinak přijde
 * `responseCode 247 INVALID_ADRESS` — což svádí sáhnout po `point.id`. Jsou to
 * ale dvě podoby téhož čísla: widget vrací `id` jako `B` + `zip`
 * (`B10109` / `10109`). Ověřeno na skutečných košících v databázi — z osmi
 * různých výdejen jich šest tenhle vztah splňuje a **zbylé dvě mají `id`
 * zástupné (`12345`)**, zatímco `zip` je u všech osmi správně.
 *
 * `point.zip` je tedy ta spolehlivá polovina. Navíc `point.address` obsahuje
 * PSČ městské části, které se od výdejního liší — proto ani to.
 */
export const adresaPrijemce = (vstup: VstupPodani): Record<string, unknown> => {
  const { serviceCode, prijemce, vydejna } = vstup

  if (serviceCode === "NB") {
    if (!vydejna?.zip) {
      throw new Error(
        "Zásilka do Balíkovny nemá vybranou výdejnu (order.metadata.balikovna_point_zip chybí)."
      )
    }
    return { street: "Balíkovna", zipCode: normalizujPsc(vydejna.zip) }
  }

  const rozpad = rozdelAdresu(prijemce.address_1)
  return {
    ...rozpad,
    city: String(prijemce.city ?? "").trim(),
    zipCode: normalizujPsc(prijemce.postal_code),
  }
}

/** Celé tělo požadavku. */
export const sestavPodani = (vstup: VstupPodani): Record<string, unknown> => {
  const { prijemce, odesilatel, dobirka, serviceCode } = vstup
  const datum = vstup.datum ?? new Date().toISOString().slice(0, 10)

  const jmeno = String(prijemce.first_name ?? "").trim()
  const prijmeni = String(prijemce.last_name ?? "").trim()

  const parcelParams: Record<string, unknown> = {
    recordID: "1",
    prefixParcelCode: serviceCode,
    /* ČP chce váhu jako řetězec v kilogramech. */
    weight: String(vstup.vaha),
    currency: "CZK",
  }

  /*
   * Udaná cena je povinná, ne volitelná — bez ní přijde `336
   * MISSING_REQUIRED_PRICE`. Nula není přípustná hodnota, takže i u zásilky
   * s nulovým součtem (dárek, reklamace) se pošle aspoň koruna.
   */
  parcelParams.insuredValue = Math.max(1, Math.round(Number(vstup.udanaCena ?? 0)))

  if (dobirka) {
    /*
     * Variabilní symbol je to, podle čeho se přijatá dobírka spáruje s
     * objednávkou. Bez něj přijdou peníze na účet bez identifikace.
     */
    parcelParams.amount = Math.round(dobirka.castka)
    parcelParams.vsVoucher = dobirka.variabilniSymbol
  }

  const parcelAddress: Record<string, unknown> = {
    recordID: "1",
    address: adresaPrijemce(vstup),
  }

  /*
   * Firma a fyzická osoba se vylučují: ČP chce buď `companyName`, nebo jméno a
   * příjmení. Firma má přednost, protože když ji zákazník vyplnil, je to
   * doručovací adresa firmy.
   */
  const firma = String(prijemce.company ?? "").trim()
  if (firma) {
    parcelAddress.companyName = firma
  } else {
    if (jmeno) parcelAddress.firstName = jmeno
    if (prijmeni) parcelAddress.surname = prijmeni
  }

  const telefon = normalizujTelefon(prijemce.phone)
  if (telefon) parcelAddress.mobilNumber = telefon

  const email = String(vstup.email ?? "").trim()
  if (email) parcelAddress.emailAddress = email

  /*
   * U Balíkovny je kontakt na adresáta povinný — je to jediné, čím se zákazník
   * dozví, že má zásilku vyzvednout. Bez něj balík na výdejně jen leží, dokud
   * mu nevyprší lhůta, a vrátí se zpátky.
   */
  if (serviceCode === "NB" && !telefon && !email) {
    throw new Error(
      "Zásilka do Balíkovny musí nést telefon nebo e-mail příjemce — bez toho se zákazník o zásilce nedozví."
    )
  }

  return {
    parcelServiceHeader: {
      parcelServiceHeaderCom: {
        transmissionDate: datum,
        customerID: odesilatel.customerId,
        postCode: odesilatel.postCode,
        locationNumber: odesilatel.locationNumber,
      },
      /* `idForm: 101` = štítek, který ČP vrací rovnou v odpovědi. */
      printParams: { idForm: 101, shiftHorizontal: 0, shiftVertical: 0 },
      position: 1,
    },
    parcelServiceData: {
      parcelParams,
      parcelServices: vstup.sluzby,
      parcelAddress,
    },
  }
}

export type VysledekPodani = {
  /** Přijala ČP zásilku? Jen tohle rozhoduje — ne stavový kód HTTP. */
  ok: boolean
  cisloZasilky?: string
  stitekBase64?: string
  /** Důvody odmítnutí, česky složené z kódů ČP. */
  chyby: string[]
}

/**
 * Výsledek podání.
 *
 * ## HTTP 200 neznamená přijatou zásilku
 *
 * Tohle je nejdůležitější věta v celém modulu a stála jedno kolo měření. ČP
 * odpovídá `200` i na podání, které **odmítla** — skutečný verdikt je až
 * v těle:
 *
 * ```
 * {"responseHeader":{"resultHeader":{"responseCode":19,"responseText":"BATCH_INVALID"},
 *   "resultParcelData":[{"parcelCode":"","parcelStateResponse":[
 *     {"responseCode":261,"responseText":"MISSING_SIZE_CATEGORY"}]}]}}
 * ```
 *
 * `responseCode: 1` je přijetí, cokoli jiného odmítnutí. Prázdný `parcelCode`
 * je druhé potvrzení téhož. Kdo by se řídil stavovým kódem HTTP, oznámil by
 * zákazníkovi odeslání zásilky, která nikdy nevznikla.
 *
 * ## Stavy `INFO_*` nejsou chyby
 *
 * `408 INFO_ADDRESS_WAS_MODIFIED` a `429 INFO_NOTIFICIATON_WAS_MODIFIED`
 * (překlep je jejich) chodí i u přijatých zásilek — ČP jimi hlásí, že si
 * adresu nebo způsob avíza sama upravila. Do chyb nepatří.
 *
 * Podání a štítek jsou **jedno volání**: PDF chodí rovnou v odpovědi.
 */
export const prectiOdpoved = (telo: any): VysledekPodani => {
  const hlavicka = telo?.responseHeader ?? telo?.parcelServiceHeaderResult ?? telo
  const zasilky = hlavicka?.resultParcelData ?? telo?.resultParcelData
  const kus = Array.isArray(zasilky) ? zasilky[0] : undefined

  const cisloZasilky = String(kus?.parcelCode ?? telo?.parcelCode ?? "").trim()
  const stitekBase64 =
    telo?.responsePrintParams?.file ?? hlavicka?.responsePrintParams?.file ?? undefined

  const stavy: any[] = kus?.parcelStateResponse ?? []
  const chyby = stavy
    .filter((s) => !String(s?.responseText ?? "").startsWith("INFO_") && s?.responseCode !== 1)
    .map((s) => `${s?.responseCode} ${s?.responseText}`)

  const hlavniKod = hlavicka?.resultHeader?.responseCode
  if (hlavniKod !== undefined && hlavniKod !== 1 && !chyby.length) {
    /* Odmítnutí bez bližšího určení — ať se aspoň ví, že odmítnutí bylo. */
    chyby.push(`${hlavniKod} ${hlavicka?.resultHeader?.responseText ?? "neznámý důvod"}`)
  }

  return {
    ok: Boolean(cisloZasilky) && !chyby.length,
    ...(cisloZasilky ? { cisloZasilky } : {}),
    ...(stitekBase64 ? { stitekBase64: String(stitekBase64) } : {}),
    chyby,
  }
}

/**
 * Kódy, které stojí za vysvětlení, protože samy o sobě nenapovědí nic.
 *
 * Nejde o překlad — jde o to, co s tím má obsluha dělat. `247 INVALID_ADDRESS`
 * u Balíkovny znamená v devíti z deseti případů, že se testuje proti
 * testovacímu prostředí, které zná jen vlastní smyšlené výdejny.
 */
export const VYSVETLENI_KODU: Record<string, string> = {
  "247": "Česká pošta nezná tuhle výdejnu Balíkovny. V testovacím prostředí to je běžné — zná jen vlastní zkušební výdejny, ne skutečné.",
  "309": "Adresa příjemce není platná pro zvolenou službu.",
  "261": "Chybí velikostní kategorie zásilky (S/M/L/XL).",
  "336": "Chybí udaná cena zásilky.",
  "105": "Udaná cena je neplatná.",
  "36": "Částka dobírky nesmí obsahovat půlhaléře.",
  "11": "U dobírky chybí variabilní symbol.",
  "17": "Variabilní symbol musí být číselný a desetimístný.",
  "18": "Variabilní symbol už byl použit u jiné zásilky.",
  "101": "Tohle číslo zásilky už Česká pošta zná — použít se dá až po 13 měsících.",
}

/** Chyby i s vysvětlením, jedna věta na řádek. */
export const popisChyb = (chyby: string[]): string =>
  chyby
    .map((chyba) => {
      const kod = chyba.split(" ")[0]
      const vysvetleni = VYSVETLENI_KODU[kod]
      return vysvetleni ? `${chyba} — ${vysvetleni}` : chyba
    })
    .join("; ")

/**
 * Chybová hláška z odpovědi ČP, česky a čitelně.
 *
 * ČP vrací pole objektů `{code, status, message}` a `message` bývá anglicky a
 * o poli, které v naší terminologii neexistuje. Do logu jde celé, ale do
 * hlášky, kterou uvidí obsluha, jde jen to podstatné.
 */
export const chybaZOdpovedi = (status: number, telo: any, raw: string): string => {
  const polozky = Array.isArray(telo) ? telo : telo?.errors ?? telo?.error ?? []
  const zpravy = (Array.isArray(polozky) ? polozky : [polozky])
    .map((p: any) => p?.message ?? p?.errorMessage)
    .filter(Boolean)

  if (zpravy.length) return `HTTP ${status}: ${zpravy.join("; ")}`
  return `HTTP ${status}: ${raw.slice(0, 300)}`
}
