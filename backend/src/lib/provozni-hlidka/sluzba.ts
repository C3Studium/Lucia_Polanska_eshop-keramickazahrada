/**
 * Která cizí služba je ve hře (3. 11. 2026).
 *
 * ## Proč to patří do alarmu
 *
 * „Platby nefungují" je zpráva, se kterou se nedá nic udělat. „Platby —
 * ComGate" říká, kam jít: do portálu brány, zkontrolovat notifikační URL.
 * Rozdíl mezi tím a Českou poštou je rozdíl mezi dvěma úplně jinými
 * odpoledni, a v okamžiku alarmu to má být vidět z předmětu e-mailu.
 *
 * Hádá se ze tří vodítek, protože ani jedno samo nestačí: cesta zná bránu
 * u webhooku, ale ne u úlohy; název akce zná úlohu, ale ne důvod; text chyby
 * zná jméno služby i tam, kde ho cesta nenese.
 */

export type CiziSluzba =
  | "ComGate"
  | "Česká pošta"
  | "iDoklad"
  | "Resend"
  | "Studio"
  | "Zásilkovna"
  | null

/**
 * Pořadí rozhoduje — první shoda vyhrává. Konkrétnější vzory stojí výš, aby
 * „balikovna" nespadla pod obecnou poštu jiné služby.
 */
const VZORY: Array<{ vzor: RegExp; sluzba: NonNullable<CiziSluzba> }> = [
  { vzor: /comgate|pp_comgate|cg_?merchant/i, sluzba: "ComGate" },
  {
    /* Kmeny, ne celá slova: hlásí se „na Balíkovnu", „České poště",
       „Českou poštou" — pád se mění a služba zůstává táž. */
    vzor: /cesk\w*[-_ ]*po[šs]t|bal[íi]kovn|\bnapi\b|cp[-_]napi|parcel-?tracking/i,
    sluzba: "Česká pošta",
  },
  { vzor: /idoklad/i, sluzba: "iDoklad" },
  { vzor: /zasilkovna|z[áa]silkovna|packeta/i, sluzba: "Zásilkovna" },
  { vzor: /resend/i, sluzba: "Resend" },
  { vzor: /supabase|valecms|vale-?cms|\bcms\b|studio/i, sluzba: "Studio" },
]

/**
 * Pozná službu z cesty, názvu akce a textu chyby. `null` znamená „žádná
 * cizí služba v tom není" — tedy chyba doma, a to je samo o sobě vodítko.
 */
export const ciziSluzba = (...vodítka: Array<string | null | undefined>): CiziSluzba => {
  const text = vodítka.filter(Boolean).join(" ")
  if (!text) return null

  for (const { vzor, sluzba } of VZORY) {
    if (vzor.test(text)) return sluzba
  }
  return null
}

/** „Platby — ComGate" · „Platby", když cizí služba ve hře není. */
export const nazevSeSluzbou = (nazev: string, sluzba: CiziSluzba): string =>
  sluzba ? `${nazev} — ${sluzba}` : nazev
