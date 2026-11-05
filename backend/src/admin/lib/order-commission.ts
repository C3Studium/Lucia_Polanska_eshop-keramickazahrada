/**
 * Má objednávka aspoň jednu zakázkovou položku?
 *
 * Čte se razítko na položce (`metadata.made_to_order`), které tam zapíše
 * pokladna — totéž pole, podle kterého zakázku poznává server
 * (`lib/made-to-order/commission-line.ts` i dělení balíků u štítku ČP).
 *
 * K čemu to je: karty „Výroba na zakázku" a „Od zákazníka" se u běžné
 * objednávky nekreslí a je to správně. Když ale dotaz na zakázku selže, z
 * odpovědi nejde poznat, jestli se karta měla objevit — tohle to rozhodne z
 * objednávky samotné, takže hlášku „nenačteno" uvidí jen objednávka, kde
 * zakázka opravdu je.
 */
type ObjednavkaSPolozkami = {
  items?: Array<{ metadata?: Record<string, unknown> | null } | null> | null;
};

export const maZakazkovouPolozku = (order: ObjednavkaSPolozkami): boolean =>
  (order.items ?? []).some((item) => Boolean(item?.metadata?.made_to_order));
