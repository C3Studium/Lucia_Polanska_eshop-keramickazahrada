/**
 * Texty obchodu — záloha pro případ, že se nedají načíst z backendu.
 *
 * ## Kdo je zdroj pravdy
 *
 * Backend (`backend/src/lib/shop-texty.ts`). Majitelka je upravuje
 * v administraci → Právní věci a texty → Texty obchodu a web si je bere
 * z `GET /store/texty`. Tenhle soubor je jen záloha: když dotaz selže,
 * nebo komponenta stojí mimo poskytovatele, ukáže se tohle znění.
 *
 * Obě kopie musí být slovo od slova stejné — hlídá to test
 * `backend/src/lib/__tests__/shop-texty.unit.spec.ts`, který tenhle soubor
 * čte. Je to tentýž postup jako u právních údajů
 * (`lib/legal/facts.ts` × `backend/src/lib/legal-facts.ts`).
 *
 * Nepoužívat přímo. Komponenty berou texty z `useTexty()`, které tohle
 * doplní tím, co přišlo z backendu.
 */

export const TEXTY_DEFAULTS = {
  "produkt.cekani": "Není skladem — výroba obvykle trvá 3–10 dní.",
  "produkt.cena_po_domluve":
    "Objednáte teď za 0 Kč; cenu vám po domluvě pošlu e-mailem a pak zaplatíte zálohu nebo celou částku.",

  "zakazka.krok_zahajeni":
    "Začneme po připsání platby. V den, kdy začneme, vám pošleme e-mail „Zakázka je ve výrobě“ s datem a časem — od něj je výroba zahájena.",
  "zakazka.krok_dokonceni":
    "Do {{dny}} dnů od zahájení výroby. Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu.",
  "zakazka.krok_dokonceni_bez_lhuty":
    "Lhůtu od zahájení výroby najdete v potvrzení zakázky. Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu.",
  "zakazka.krok_schvaleni":
    "Pošleme vám fotografii hotového tvaru. Máte 5 pracovních dnů (připomeneme se). Schválená podoba je ujednanou vlastností výrobku; nesoulad se zadáním zůstává vadou vždy.",
  "zakazka.krok_odeslani":
    "Do 2 pracovních dnů od doplatku, pojištěný křehký balík — nebo vám dáme vědět, že je kus připravený k vyzvednutí.",

  "kosik.cena_po_domluve":
    "Výrobky s cenou po domluvě nejsou v částkách výš — cenu vám pošlu e-mailem a zaplatíte ji potom.",
  "kosik.poukaz_vse":
    "Celou objednávku hradí dárkový poukaz — nic dalšího neplatíte.",

  "pokladna.cena_po_domluve_nula":
    "Teď se nic neplatí. Až spolu domluvíme cenu, pošlu vám ji e-mailem — i s poštovným, pokud si kus necháte poslat — a zaplatíte zálohu nebo celou částku.",
  "pokladna.doprava_krehke":
    "Vybrali jste křehký kus. Aby dorazil v pořádku, posíláme ho jen jako křehký balík Českou poštou — nebo si pro něj můžete přijet do ateliéru.",
  "pokladna.doprava_zakazka":
    "Zakázkovou výrobu posíláme jen jako křehký balík. Nebo si pro ni můžete přijet do ateliéru.",
  "pokladna.doprava_cena_po_domluve":
    "V košíku máte výrobek s cenou po domluvě. Vyberte si tady, jak vám ho mám doručit; posílám jen jako křehký balík, nebo si pro kus můžete přijet do ateliéru. Cenu výrobku vám pak pošlu e-mailem a zaplatíte ji až potom.",

  "objednavka.potvrzeni":
    "Potvrzení jsme poslali na {{email}}. Jakmile se něco pohne, ozveme se vám znovu.",
} as const

export type ShopTextKey = keyof typeof TEXTY_DEFAULTS
export type ShopTexty = Record<ShopTextKey, string>

/**
 * Dosadí za značky skutečné hodnoty. Co se nedodá, zůstane nenahrazené —
 * raději ať je ve větě vidět `{{dny}}`, než aby tiše tvrdila nesmysl.
 */
export const dosadZnacky = (
  text: string,
  hodnoty: Record<string, string | number | null | undefined>
): string => {
  let out = text
  for (const [znacka, hodnota] of Object.entries(hodnoty)) {
    if (hodnota === null || hodnota === undefined) continue
    out = out.split(`{{${znacka}}}`).join(String(hodnota))
  }
  return out
}
