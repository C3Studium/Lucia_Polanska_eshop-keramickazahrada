/**
 * Text tlačítka, kterým se objednávka odesílá (§ 1826a odst. 2 OZ).
 *
 * Zákon chce, aby tlačítko jednoznačně říkalo, že zakládá povinnost platit —
 * „Objednat", „Dokončit" ani „Zaplatit" to nesplní, a bez toho smlouva
 * spotřebitele nezavazuje. Proto jedno znění na každém ovládacím prvku, který
 * objednávku odesílá nebo spouští její platbu (Přehled, všechny varianty
 * `PaymentButton`, rychlý nákup). Způsob platby a částka patří do věty vedle
 * tlačítka, ne do jeho názvu. Stejné znění musí stát v OP (čl. o uzavření
 * smlouvy).
 */
export const ORDER_BUTTON_LABEL = "Objednávka zavazující k platbě"

/** Totéž pro rezervaci kurzu (smlouva o službě, ne kupní smlouva). */
export const COURSE_BUTTON_LABEL = "Rezervace zavazující k platbě"

/**
 * Cesty právních stránek pro KLIENTSKÉ komponenty (pokladna, stránka
 * produktu, rezervace kurzu). Zrcadlí `LEGAL_PATHS` z `@lib/legal/registry`
 * — ten ale importuje celé texty všech verzí dokumentů, a v klientské
 * komponentě by je přibalil do JavaScriptu pokladny. Kotvy (`#kurzy`,
 * `#vyroba-na-zakazku`) jsou id kapitol OP.
 */
export const LEGAL_LINKS = {
  terms: "/smluvni-podminky",
  termsCourses: "/smluvni-podminky#kurzy",
  termsMadeToOrder: "/smluvni-podminky#vyroba-na-zakazku",
  withdrawal: "/odstoupeni-od-smlouvy",
  privacy: "/ochrana-osobnich-udaju",
  complaints: "/reklamacni-rad",
  shipping: "/doprava-a-platba",
} as const
