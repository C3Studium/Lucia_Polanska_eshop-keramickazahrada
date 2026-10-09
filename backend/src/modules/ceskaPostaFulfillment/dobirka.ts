import { toNumber } from "../../lib/order-quantity"

/**
 * Dobírka z metadat objednávky — ČISTÉ rozhodnutí pro podání u České pošty.
 *
 * Provider běží v kontejneru fulfillment modulu, kde `payment_collections`
 * nejsou a dotáhnout je nelze. Fakta o dobírce proto do `order.metadata`
 * razítkuje `stampDobirkaStep` (ship-merchant-order / generate-cp-label):
 *
 * - `cp_dobirka_zjistena: true` — razítko proběhlo (klíč chybí = objednávka
 *   přišla jinudy, třeba nativní stránkou, a o platbě se neví);
 * - `cp_dobirka: boolean` — JE platba dobírkou? (od 9. 10. 2026);
 * - `cp_dobirka_czk: number` — kolik má dopravce vybrat (0 = bez dobírky).
 *
 * ## Proč tvrdá chyba, a ne tiché podání bez dobírky
 *
 * Když je objednávka na dobírku a částka chybí nebo je nulová, zásilka BEZ
 * dobírky znamená: zboží odejde, peníze nepřijdou — a pozná se to až podle
 * toho, že nikdy nedorazí. Dřív se v tom případě tiše podalo bez dobírky.
 * Teď se podání odmítne (`ok: false` → provider vrátí `mode: "manual"` s
 * důvodem, A1 zastaví odeslání a objednávka zůstane v „K odeslání").
 *
 * Starší razítka bez `cp_dobirka` (před 9. 10.) se chovají jako dřív: částka
 * > 0 → dobírka, jinak bez — nemáme podle čeho poznat, že měla být.
 */
export type RozhodnutiDobirky =
  | {
      ok: true
      /** `null` = podat bez dobírky. */
      dobirka: { castka: number } | null
      /** Co zalogovat jako varování (např. chybějící razítko). */
      varovani: string | null
    }
  | { ok: false; duvod: string }

export const rozhodniDobirku = (
  metadata: Record<string, unknown> | null | undefined
): RozhodnutiDobirky => {
  const meta = metadata ?? {}

  if (meta.cp_dobirka_zjistena !== true) {
    return {
      ok: true,
      dobirka: null,
      varovani:
        "chybí údaj o dobírce (cp_dobirka_zjistena). Podávám bez dobírky — ověř, že se nemá vybírat hotovost.",
    }
  }

  const castka = toNumber(meta.cp_dobirka_czk)
  const jeDobirka = meta.cp_dobirka === true

  if (!(castka > 0)) {
    if (jeDobirka) {
      return {
        ok: false,
        duvod:
          "objednávka je na dobírku, ale částka k vybrání chybí nebo je nulová (cp_dobirka_czk). " +
          "Zásilka se NEPODALA — bez dobírky by odešla a peníze by nepřišly. " +
          "Zkontroluj celkovou cenu objednávky a zkus odeslání znovu.",
      }
    }
    return { ok: true, dobirka: null, varovani: null }
  }

  /* Půlhaléře ČP odmítá (chyba 36) a zásilku vrací bez možnosti opravy. */
  return { ok: true, dobirka: { castka: Math.round(castka) }, varovani: null }
}
