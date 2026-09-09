/**
 * Denní strop odesílání e-mailů — a poslední zpráva, která se z něj utratí za
 * varování majitelce.
 *
 * ## Proč to existuje
 *
 * Účet u Resendu má denní kvótu (dnes 100 zpráv; viz `RESEND_DAILY_QUOTA`).
 * Když dojde, Resend prostě začne odmítat — v administraci se objeví řádky
 * „Nepodařilo se" a nikdo se nedozví proč. 9. 9. 2026 se to stalo doopravdy:
 * noční upomínky na opuštěné košíky vyčerpaly celý den a potvrzení objednávky
 * pak nemělo z čeho odejít.
 *
 * Pravidlo je proto tohle: **poslední zpráva ze stropu se neutratí za zákazníka,
 * ale za e-mail majitelce, že strop došel.** Radši jeden nedoručený e-mail
 * a vědomí, že se to děje, než dvacet tiše zahozených.
 *
 * ## Co tenhle soubor NEdělá
 *
 * Nepočítá napříč procesy. Backend a Backend-worker jsou dvě služby, každá si
 * vede vlastní počítadlo, takže dohromady můžou strop překročit dřív, než
 * varování odejde. Přesné číslo umí jen databáze (tabulka `notification`,
 * `status='success'` za dnešek) a to je práce na příště — poznámka je
 * v `TODO.md`. Pro dnešek platí, že hromadné odesílání běží jen ve workeru,
 * takže to jedno počítadlo pokrývá případ, kvůli kterému to vzniklo.
 *
 * Logika je schválně oddělená od providera: jde o rozhodovací pravidlo, které
 * se dá otestovat bez klíče, bez sítě a bez odeslané zprávy.
 */

/** Kvóta se počítá po dnech v UTC — Resend se řídí UTC, ne Prahou. */
export const denKvoty = (ted: Date): string => ted.toISOString().slice(0, 10)

export type StavKvoty = {
  /** Den, ke kterému se počítadlo vztahuje (`YYYY-MM-DD`, UTC). */
  den: string
  /** Kolik zpráv už ten den odešlo. */
  odeslano: number
  /** Jestli už za dnešek odešlo varování o vyčerpaném stropu. */
  varovaniOdeslano: boolean
}

export const novyStav = (ted: Date): StavKvoty => ({
  den: denKvoty(ted),
  odeslano: 0,
  varovaniOdeslano: false,
})

/** Přetočí počítadlo, když se překlopil den. Jinak vrátí ten samý objekt. */
export const proDen = (stav: StavKvoty, ted: Date): StavKvoty =>
  stav.den === denKvoty(ted) ? stav : novyStav(ted)

export type RozhodnutiKvoty =
  /** Pošli normálně. */
  | "posli"
  /** Tuhle zprávu neposílej — poslední kus stropu patří varování majitelce. */
  | "posliVarovani"
  /** Strop je vyčerpaný a varování už odešlo. Nic dalšího dnes neodejde. */
  | "zastav"

/**
 * @param kvota  Denní strop. Nula nebo záporné číslo funkci vypíná — kdo strop
 *               nezná, ať radši posílá, než aby web přestal odesílat kvůli
 *               číslu, které si někdo vymyslel.
 * @param jeVarovani Zpráva je samo to varování. Ta projde vždycky, jinak by se
 *               nikdy nemělo jak dostat ven.
 */
export const rozhodniOKvote = (
  stav: StavKvoty,
  kvota: number,
  jeVarovani: boolean
): RozhodnutiKvoty => {
  if (jeVarovani) {
    return "posli"
  }
  if (!Number.isFinite(kvota) || kvota <= 0) {
    return "posli"
  }
  if (stav.odeslano < kvota - 1) {
    return "posli"
  }
  if (!stav.varovaniOdeslano) {
    return "posliVarovani"
  }
  return "zastav"
}

/** Text varování. Zvlášť, ať se dá zkontrolovat, že říká, co se stalo a co s tím. */
export const textVarovani = (kvota: number, den: string) => ({
  predmet: "Došel denní limit odesílání e-mailů",
  nadpis: "Došel denní limit odesílání e-mailů",
  popis:
    `Za dnešek (${den} UTC) se vyčerpal denní strop ${kvota} e-mailů u služby ` +
    "Resend. Tenhle e-mail je poslední, který se do stropu vešel.\n\n" +
    "Do půlnoci UTC neodejdou žádná potvrzení objednávek, obnovení hesla ani " +
    "ověřovací e-maily — zákazníkům se zobrazí, že akce proběhla, ale zpráva " +
    "jim nepřijde. V administraci je uvidíte v Přehled → Odeslané e-maily jako " +
    "nezdařené a půjde je poslat znovu.\n\n" +
    "Co s tím: buď počkat na půlnoc UTC, kdy se strop obnoví, nebo navýšit " +
    "tarif u Resendu.",
})
