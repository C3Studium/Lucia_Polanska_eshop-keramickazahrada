import type { CpZiveTabulka } from "./index"

/**
 * Stažení ceníku České pošty do zahraničí z veřejné kalkulačky
 * postaonline.cz/kalkulacka-postovneho (19. 11. 2026, Matěj: „každý den
 * stáhnout data z webu, když to nejde, poslat e-mail; jako záloha poslední
 * stažená data").
 *
 * Volá TYTÉŽ dotazy jako formulář kalkulačky v prohlížeči (docs/cp-kalkulacka/
 * PLAN.md §4): `weights` (jaké váhy do země jdou) a pro každou váhu
 * `consignments` (ceny všech služeb). Balík, bez pojištění, bez doplňkových
 * služeb; cena s DPH (`roundedPriceWithVat`) — tu platí zákazník.
 *
 * Ohleduplně: jen země obchodu (~10), dotazy jeden po druhém s pauzou
 * 1,5–3 s (≈ 300 dotazů jednou za noc, ~12 min), běžné hlavičky prohlížeče
 * a odkaz na stránku kalkulačky. Nic se neobchází — když kalkulačka odmítne,
 * je to chyba a přijde e-mail.
 */

const NS = "_calcsspconsignment_WAR_calcsspportlet_"
const BASE =
  "https://www.postaonline.cz/kalkulacka-postovneho?p_p_id=calcsspconsignment_WAR_calcsspportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1&p_p_resource_id="
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
  "x-requested-with": "XMLHttpRequest",
  accept: "application/json",
  "accept-language": "cs-CZ,cs;q=0.9",
  referer: "https://www.postaonline.cz/kalkulacka-postovneho",
}

export type CpStahovani = {
  /** Kolikrát se zkusí jeden dotaz (výchozí 3). */
  pokusy?: number
  /** Pauza mezi dotazy v ms [od, do] (výchozí 1500–3000). */
  pauza?: [number, number]
  /** Pro testy: vlastní fetch. */
  fetchFn?: typeof fetch
  log?: (zprava: string) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class CpChyba extends Error {}

const nahodnaPauza = (rozsah: [number, number]) => rozsah[0] + Math.random() * (rozsah[1] - rozsah[0])

/** Jeden dotaz s opakováním; vrací JSON, nebo vyhodí srozumitelnou chybu. */
const dotaz = async (
  url: string,
  init: RequestInit,
  volby: Required<Pick<CpStahovani, "pokusy">> & { fetchFn: typeof fetch },
  /** U `consignments` je „žádný produkt" (400) platná odpověď = tam to nejede. */
  zadnyProduktJePrazdno = false
): Promise<any> => {
  let posledni = ""
  for (let pokus = 1; pokus <= volby.pokusy; pokus++) {
    try {
      const response = await volby.fetchFn(url, { ...init, signal: AbortSignal.timeout(20_000) })
      const text = await response.text()
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        throw new CpChyba(`odpověď není JSON (HTTP ${response.status}): ${text.slice(0, 120).replace(/\s+/g, " ")}`)
      }
      if (response.ok) return json
      if (zadnyProduktJePrazdno && String(json?.error?.[0]?.value ?? "").includes("neodpovídá")) {
        return { parcelProducts: [], expressProducts: [] }
      }
      throw new CpChyba(`HTTP ${response.status}: ${String(json?.error?.[0]?.value ?? text).slice(0, 120)}`)
    } catch (error) {
      posledni = error instanceof Error ? error.message : String(error)
    }
    if (pokus < volby.pokusy) await sleep(3000 * pokus)
  }
  throw new CpChyba(posledni || "bez odpovědi")
}

/** Ceny všech služeb do jedné země pro všechny váhy, které kalkulačka nabízí. */
export const stahniZemi = async (
  country: string,
  volby: CpStahovani = {}
): Promise<Record<string, Array<[number, number]>>> => {
  const code = country.toUpperCase()
  const fetchFn = volby.fetchFn ?? fetch
  const pauza = volby.pauza ?? [1500, 3000]
  const opak = { pokusy: volby.pokusy ?? 3, fetchFn }

  const weights = await dotaz(
    `${BASE}weights&${NS}targetCountry=${code}&${NS}type=1`,
    { headers: HEADERS },
    opak
  )
  const vahy = Object.keys(weights ?? {}).sort((a, b) => Number(a) - Number(b))
  const sluzby: Record<string, Array<[number, number]>> = {}
  for (const vaha of vahy) {
    await sleep(nahodnaPauza(pauza))
    const form = {
      type: 1,
      targetCountry: code,
      size: null,
      weight: vaha,
      insuranceAmount: 1,
      length: "",
      width: "",
      height: "",
      dimensions: "",
      weightUnits: "1",
      insurance: "0",
      confirmation: true,
      hasCustomerCard: false,
      nonStandard: false,
      eData: false,
      dimensionsUnits: "1",
    }
    const json = await dotaz(
      `${BASE}consignments&${NS}data=${encodeURIComponent(JSON.stringify(form))}`,
      { method: "POST", headers: { ...HEADERS, "content-type": "application/json" }, body: "{}" },
      opak,
      true
    )
    for (const produkt of [...(json?.parcelProducts ?? []), ...(json?.expressProducts ?? [])]) {
      const nazev = String(produkt?.productName ?? "").trim()
      const cena = Number(produkt?.roundedPriceWithVat)
      if (!nazev || !Number.isFinite(cena) || cena <= 0) continue
      ;(sluzby[nazev] ??= []).push([Number(vaha), cena])
    }
  }
  for (const nazev of Object.keys(sluzby)) sluzby[nazev].sort((a, b) => a[0] - b[0])
  return sluzby
}

export type CpVysledek = {
  /** Země stažené celé (jen ty se přepíšou). */
  zeme: CpZiveTabulka
  /** Země, které se nepodařilo stáhnout (zůstanou poslední data). */
  chyby: Array<{ country: string; chyba: string }>
}

/** Stáhne země jednu po druhé. Chyba jedné země nezastaví ostatní. */
export const stahniCenikCp = async (countries: string[], volby: CpStahovani = {}): Promise<CpVysledek> => {
  const zeme: CpZiveTabulka = {}
  const chyby: CpVysledek["chyby"] = []
  for (const country of countries) {
    try {
      const data = await stahniZemi(country, volby)
      zeme[country.toLowerCase()] = data
      volby.log?.(`[cp-cenik] ${country.toUpperCase()}: ${Object.keys(data).length} služeb`)
    } catch (error) {
      const chyba = error instanceof Error ? error.message : String(error)
      chyby.push({ country: country.toLowerCase(), chyba })
      volby.log?.(`[cp-cenik] ${country.toUpperCase()}: CHYBA — ${chyba}`)
    }
  }
  return { zeme, chyby }
}

/** Kolik cen se změnilo proti předchozím datům (pro e-mail), s ukázkou. */
export const rozdilCeniku = (
  stary: CpZiveTabulka,
  novy: CpZiveTabulka
): { pocet: number; ukazka: string[] } => {
  const ukazka: string[] = []
  let pocet = 0
  for (const [country, sluzby] of Object.entries(novy)) {
    for (const [sluzba, stupne] of Object.entries(sluzby)) {
      for (const [kg, cena] of stupne) {
        const predtim = stary?.[country]?.[sluzba]?.find(([k]) => k === kg)?.[1]
        if (predtim !== undefined && predtim !== cena) {
          pocet++
          if (ukazka.length < 8) ukazka.push(`${country.toUpperCase()} ${sluzba} do ${kg} kg: ${predtim} → ${cena} Kč`)
        }
      }
    }
  }
  return { pocet, ukazka }
}
