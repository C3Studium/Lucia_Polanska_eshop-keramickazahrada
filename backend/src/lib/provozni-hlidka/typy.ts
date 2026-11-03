/**
 * Provozní hlídka — typy (3. 11. 2026).
 *
 * ## Proč to existuje
 *
 * Obchod umí dvanáct druhů e-mailů, čtyři smiřovací úlohy, dvě externí
 * brány a fakturaci. Když z toho něco tiše přestane fungovat, nepřijde
 * žádná chyba — jen se něco nestane. Objednávka #68 je ten případ:
 * platba dorazila, faktura nevznikla, a zjistilo se to až po týdnu, když
 * se někdo ptal. Mezi „funguje" a „nefunguje" je tedy ticho, a ticho se
 * nedá sledovat.
 *
 * Hlídka to ticho převádí na dvě věty, které už sledovat jdou: každých
 * patnáct minut se zeptá na výsledky (ne na služby — na to, co z nich má
 * vypadnout), a na konci dne pošle, co všechno kontrolovala.
 *
 * Záměrně se neptá bran, jestli odpovídají. Odpověď brány nic neříká o
 * tom, že platba doputovala k objednávce — notifikační URL ComGate byla
 * nenastavená třikrát a brána přitom odpovídala pokaždé. Kontroluje se
 * proto výsledek: zaplaceno bez faktury, autorizováno bez zachycení,
 * prodejná varianta bez skladové úrovně.
 */

/**
 * `nenastaveno` není chyba: hlídka nemá budit kvůli tomu, že něco
 * (např. adresa obchodu) není v prostředí vyplněné. Do souhrnu to patří,
 * do alarmu ne — jinak se lidi naučí alarmy ignorovat.
 */
export type StavKontroly = "ok" | "chyba" | "nenastaveno"

/** Co jedna kontrola zjistila. */
export type NalezKontroly = {
  stav: StavKontroly
  /** Jedna věta česky — co je v pořádku, nebo co je špatně. */
  zprava: string
  /**
   * Přesné podrobnosti pro vývojáře: číslo objednávky, klíč metadat,
   * text výjimky, odpověď služby. Tohle je to, co má smysl vložit do
   * chatu — proto čísla a identifikátory, ne popis dojmu.
   */
  detail?: string[]
}

export type VysledekKontroly = NalezKontroly & {
  /** Stabilní klíč — drží dedupe alarmu, takže se nikdy nemění. */
  klic: string
  /** Česky, jak se to jmenuje v souhrnu („Faktury v iDokladu"). */
  nazev: string
}

export type Kontrola = {
  klic: string
  nazev: string
  /**
   * Výjimka z kontroly je taky nález — běžec ji zabalí do `chyba`
   * s textem výjimky. Jedna rozbitá kontrola nesmí shodit hlídku,
   * protože pak přestanou fungovat i ty ostatní.
   */
  spust: (container: unknown) => Promise<NalezKontroly>
}
