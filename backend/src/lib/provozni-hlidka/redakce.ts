/**
 * Redakce těl požadavků (3. 11. 2026).
 *
 * ## Proč se těla vůbec ukládají
 *
 * Bez těla se u spadlé akce dohledává naslepo: „POST /admin/products selhalo
 * 422" neřekne, které pole bylo špatně. S tělem je chyba vidět na první
 * pohled a dá se zopakovat.
 *
 * ## Proč se ukládají přečištěná
 *
 * V tělech jdou hesla, platební údaje a podpisy. Deník je drží třicet dní a
 * posílají se v alarmech e-mailem — jedno zapomenuté pole by znamenalo heslo
 * zákazníka v cizí poštovní schránce.
 *
 * Čistí se proto dvakrát:
 *
 * 1. **Podle názvu pole.** Všechno, co zní jako tajemství (`password`,
 *    `token`, `cvv`, `card`, `signature`…), se nahradí `[skryto]`. Seznam je
 *    schválně široký — zbytečně skrytá hodnota nic nestojí, prozrazená ano.
 * 2. **Podle tvaru hodnoty.** Dlouhý řetězec s tvarem JWT nebo klíče se skryje
 *    i tehdy, když se pole jmenuje nevinně. Právě takhle tajemství uniká:
 *    nese ho pole, na které si seznam nevzpomněl.
 */

/** Název pole, jehož hodnota se nikdy neukládá. */
const CITLIVY_NAZEV =
  /(pass|pwd|heslo|token|secret|tajemstvi|authorization|auth|api[-_]?key|apikey|cvv|cvc|card|pan|iban|signature|podpis|jwt|cookie|session|otp|verifier|credential|private)/i

/** Tvar hodnoty, která je tajemstvím bez ohledu na název pole. */
const CITLIVY_TVAR = [
  /** JWT: tři úseky base64url oddělené tečkami. */
  /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/,
  /** Předpony klíčů, které se v tomhle projektu vyskytují. */
  /^(sk|pk|rk|re|whsec|Bearer)[-_ ]/i,
  /** Číslo karty: 13–19 číslic, i po skupinách. */
  /^(?:\d[ -]?){13,19}$/,
]

const SKRYTO = "[skryto]"

/** Delší text se zkrátí — do alarmu se čte prvních pár řádků, ne příloha. */
const STROP_TEXTU = 500
/** Strop celého těla v JSON. Nad ním se uloží jen poznámka o velikosti. */
const STROP_TELA = 4000
/** Hlubší zanoření se nerozbaluje — hlubina bývá balast, ne vodítko. */
const STROP_HLOUBKY = 6
/** Z polí stačí začátek: dvacet položek ukáže tvar i vzorek. */
const STROP_POLE = 20
/**
 * Strop počtu polí objektu. Bez něj by byl strop velikosti jen zdánlivý:
 * zanoření i délka polí jsou omezené, ale objekt s tisíci klíči by prošel
 * celý a šel by do e-mailu.
 */
const STROP_KLICU = 50

const jeCitlivaHodnota = (hodnota: string): boolean =>
  CITLIVY_TVAR.some((tvar) => tvar.test(hodnota.trim()))

const zkrat = (hodnota: string): string =>
  hodnota.length > STROP_TEXTU
    ? `${hodnota.slice(0, STROP_TEXTU)}… (${hodnota.length} znaků)`
    : hodnota

/**
 * Projde hodnotu a nahradí všechno citlivé. Vrací novou strukturu — vstup
 * se nikdy nemění, protože je to pořád živé tělo požadavku.
 */
export const bezCitlivych = (hodnota: unknown, hloubka = 0): unknown => {
  if (hodnota === null || hodnota === undefined) return hodnota

  if (typeof hodnota === "string") {
    return jeCitlivaHodnota(hodnota) ? SKRYTO : zkrat(hodnota)
  }

  if (typeof hodnota === "number" || typeof hodnota === "boolean") {
    return hodnota
  }

  if (hloubka >= STROP_HLOUBKY) return "[hlouběji se nerozbaluje]"

  if (Array.isArray(hodnota)) {
    const zkracene = hodnota
      .slice(0, STROP_POLE)
      .map((polozka) => bezCitlivych(polozka, hloubka + 1))
    return hodnota.length > STROP_POLE
      ? [...zkracene, `…a dalších ${hodnota.length - STROP_POLE}`]
      : zkracene
  }

  if (typeof hodnota === "object") {
    const vysledek: Record<string, unknown> = {}
    const pary = Object.entries(hodnota as Record<string, unknown>)

    for (const [klic, polozka] of pary.slice(0, STROP_KLICU)) {
      vysledek[klic] = CITLIVY_NAZEV.test(klic)
        ? SKRYTO
        : bezCitlivych(polozka, hloubka + 1)
    }

    if (pary.length > STROP_KLICU) {
      vysledek["…"] = `a dalších ${pary.length - STROP_KLICU} polí`
    }

    return vysledek
  }

  /* Funkce, symboly, Buffery — do deníku nepatří a popisovat je nemá cenu. */
  return `[${typeof hodnota}]`
}

/**
 * Tělo požadavku pro deník: přečištěné a se stropem velikosti. `null`, když
 * tělo nebylo (GET, prázdný POST) — prázdný objekt by v deníku lhal, že
 * něco přišlo.
 */
export const teloProDenik = (telo: unknown): unknown => {
  if (telo === null || telo === undefined) return null
  if (typeof telo === "object" && !Object.keys(telo as object).length) return null

  let cistene: unknown
  try {
    cistene = bezCitlivych(telo)
  } catch {
    /* Cyklická struktura nebo exotický objekt — deník je pozorovatel, ne
       důvod ke pádu. */
    return "[tělo se nepodařilo přečíst]"
  }

  const jako = JSON.stringify(cistene)
  if (typeof jako === "string" && jako.length > STROP_TELA) {
    return `[tělo je dlouhé ${jako.length} znaků, neukládá se]`
  }

  return cistene
}
