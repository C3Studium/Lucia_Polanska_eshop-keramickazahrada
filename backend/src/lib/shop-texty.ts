/**
 * Texty obchodu — věty, které zákazník čte u výrobku, v košíku, v pokladně
 * a na hotové objednávce.
 *
 * ## Proč tohle vzniklo
 *
 * „Tyhle informace je třeba mít všechny v tom adminu, aby se to dalo
 * upravit." (Matěj za paní Polanskou, 9. 11. 2026.) Spouštěčem byla věta
 * o zakázkové výrobě a lhůta 42 dnů, která je na plastiky krátká: obojí
 * stálo napevno v kódu obchodu, takže změna znamenala nasazení.
 *
 * Teď je to přesně naopak než u obsahu webu: tyhle věty NEJSOU ve Studiu.
 * Mluví o tom, jak obchod funguje — kdy se platí, jak dlouho se vyrábí, čím
 * se posílá — a čte je i backend (e-maily). Nesmí tedy záviset na tom, jestli
 * Studio běží. Je to stejná úvaha jako u Právních údajů, a proto to bydlí
 * na stejném místě: `store.metadata.merchant_settings.shop_texts`.
 *
 * ## Co sem NEPATŘÍ
 *
 * Věty, které musí souhlasit s obchodními podmínkami nebo se zákonem —
 * poučení o 14denní lhůtě, zaškrtnutí u zakázky, předsmluvní informace.
 * Ty se mění s advokátem a s vydáním nového znění podmínek, ne v políčku.
 * Administrace je proto ani nenabízí; kde jsou, říká stránka Texty.
 *
 * ## Prázdné pole
 *
 * Prázdné pole znamená „větu vůbec neukazuj", ne „vrať výchozí". Chybějící
 * klíč naopak znamená „nikdy se neměnil" a platí výchozí znění. Formulář má
 * proto tlačítko Vrátit výchozí, které do pole vloží původní text.
 *
 * ## Bez importů
 *
 * Čte to administrace (Vite bundle v prohlížeči) i server. Import čehokoli
 * z frameworku by do adminu zatáhl celý serverový strom — stejný důvod jako
 * u `legal-facts.ts`.
 */

/** Všechny klíče v pořadí, v jakém je formulář ukazuje. */
export const SHOP_TEXT_KEYS = [
  /* Stránka výrobku */
  "produkt.cekani",
  "produkt.cena_po_domluve",
  /* Zakázková výroba — „Jak zakázka probíhá" */
  "zakazka.krok_zahajeni",
  "zakazka.krok_dokonceni",
  "zakazka.krok_dokonceni_bez_lhuty",
  "zakazka.krok_schvaleni",
  "zakazka.krok_odeslani",
  /* Košík */
  "kosik.cena_po_domluve",
  "kosik.poukaz_vse",
  /* Pokladna */
  "pokladna.cena_po_domluve_nula",
  "pokladna.doprava_krehke",
  "pokladna.doprava_zakazka",
  "pokladna.doprava_cena_po_domluve",
  /* Hotová objednávka */
  "objednavka.potvrzeni",
] as const

export type ShopTextKey = (typeof SHOP_TEXT_KEYS)[number]

/** Hodnoty všech textů. Prázdný řetězec = větu neukazovat. */
export type ShopTextValues = Record<ShopTextKey, string>

/**
 * Co je uložené v nastavení: jen klíče, které se někdy měnily.
 * Chybějící klíč = výchozí znění.
 */
export type StoredShopTexts = Partial<Record<ShopTextKey, string>>

/** Skupiny formuláře v pořadí, v jakém je stránka ukazuje. */
export const SHOP_TEXT_GROUPS = [
  "Stránka výrobku",
  "Zakázková výroba",
  "Košík",
  "Pokladna",
  "Hotová objednávka",
] as const

export type ShopTextGroup = (typeof SHOP_TEXT_GROUPS)[number]

export type ShopTextMeta = {
  /** Název pole ve formuláři. */
  label: string
  /** Co to je a kdy přesně to zákazník uvidí. */
  help: string
  group: ShopTextGroup
  /** Víceřádkové pole ve formuláři. */
  multiline: boolean
  maxLength: number
  /**
   * Zástupné značky, které se ve větě nahradí skutečnou hodnotou. Formulář je
   * vypíše a uložení pohlídá, že nezmizely — věta bez `{{dny}}` by mlčela
   * o lhůtě, což je přesně ten údaj, kvůli kterému se text mění.
   */
  znacky?: { znacka: string; popis: string; povinna: boolean }[]
  /** Adresa v obchodě, kde se text ukáže — formulář z ní udělá odkaz. */
  nahled?: string
}

export const SHOP_TEXT_META: Record<ShopTextKey, ShopTextMeta> = {
  "produkt.cekani": {
    label: "Není skladem — jak dlouho se čeká",
    help:
      "Věta pod dostupností u výrobku, který není skladem, ale jde objednat. Zákazník u něj vidí „Na objednávku“ a tahle věta mu řekne, kdy ho bude mít. Bez ní si domyslí nejhorší a košík opustí.",
    group: "Stránka výrobku",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/store",
  },
  "produkt.cena_po_domluve": {
    label: "Cena po domluvě — věta pod cenou",
    help:
      "Ukáže se u výrobku, který má cenu po domluvě. Musí být jasné, že objednávka je závazná, ale teď se neplatí nic.",
    group: "Stránka výrobku",
    multiline: true,
    maxLength: 400,
  },

  "zakazka.krok_zahajeni": {
    label: "Krok 1 — Zahájení výroby",
    help:
      "První ze čtyř kroků v bloku „Jak zakázka probíhá“ pod tlačítkem u zakázkového výrobku. Totéž čte zákazník i v PDF Potvrzení zakázky, bod 05.",
    group: "Zakázková výroba",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_dokonceni": {
    label: "Krok 2 — Dokončení (se lhůtou)",
    help:
      "Platí u zakázky, která má ve výrobním profilu vyplněnou nejdelší lhůtu. Právě tady se mění ta lhůta, co je na plastiky krátká — číslo se bere z profilu výrobku, věta jen říká, jak se podá.",
    group: "Zakázková výroba",
    multiline: true,
    maxLength: 600,
    znacky: [
      { znacka: "{{dny}}", popis: "nejdelší lhůta ve dnech z profilu výroby", povinna: true },
    ],
  },
  "zakazka.krok_dokonceni_bez_lhuty": {
    label: "Krok 2 — Dokončení (bez lhůty)",
    help:
      "Platí u zakázky, která lhůtu v profilu vyplněnou nemá. Nesmí slibovat termín — jen říct, kde ho zákazník najde.",
    group: "Zakázková výroba",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_schvaleni": {
    label: "Krok 3 — Schválení před výpalem",
    help:
      "Kdy posíláte fotku hotového tvaru a kolik času má zákazník na odpověď.",
    group: "Zakázková výroba",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_odeslani": {
    label: "Krok 4 — Odeslání",
    help: "Co se stane po doplatku — odeslání, nebo připravení k vyzvednutí.",
    group: "Zakázková výroba",
    multiline: true,
    maxLength: 600,
  },

  "kosik.cena_po_domluve": {
    label: "Cena po domluvě — věta v souhrnu",
    help:
      "Ukáže se v souhrnu košíku i pokladny, když je v košíku kus s cenou po domluvě. O poštovném tu schválně nic není: kdy se platí, závisí na zbytku košíku, a kolik se opravdu platí, říká krok Platba.",
    group: "Košík",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/cart",
  },
  "kosik.poukaz_vse": {
    label: "Celou objednávku hradí poukaz",
    help:
      "Věta u tlačítka, když dárkový poukaz pokryl celou částku a nic se nedoplácí.",
    group: "Košík",
    multiline: true,
    maxLength: 400,
  },

  "pokladna.cena_po_domluve_nula": {
    label: "Teď se neplatí nic",
    help:
      "Věta u odesílacího tlačítka v pokladně, když je k úhradě nula, protože v košíku je jen cena po domluvě. Tady patří i zmínka o poštovném — zaplatí se spolu s domluvenou cenou.",
    group: "Pokladna",
    multiline: true,
    maxLength: 500,
    nahled: "/cz/checkout",
  },
  "pokladna.doprava_krehke": {
    label: "Doručení — křehký kus",
    help:
      "Vysvětlení v kroku Doručení, proč jsou na výběr jen křehký balík a osobní odběr. Ukáže se, když je v košíku kus označený jako křehký.",
    group: "Pokladna",
    multiline: true,
    maxLength: 500,
  },
  "pokladna.doprava_zakazka": {
    label: "Doručení — zakázková výroba",
    help: "Totéž u zakázkové výroby.",
    group: "Pokladna",
    multiline: true,
    maxLength: 500,
  },
  "pokladna.doprava_cena_po_domluve": {
    label: "Doručení — cena po domluvě",
    help:
      "Totéž u kusu s cenou po domluvě. Navíc musí být jasné, že dopravu si zákazník vybere teď, ale zaplatí ji až s domluvenou cenou.",
    group: "Pokladna",
    multiline: true,
    maxLength: 600,
  },

  "objednavka.potvrzeni": {
    label: "Po odeslání objednávky",
    help:
      "První věta na stránce hotové objednávky, hned pod poděkováním. Říká, kam přišlo potvrzení a že se ozvete, jakmile se něco pohne.",
    group: "Hotová objednávka",
    multiline: true,
    maxLength: 400,
    znacky: [
      { znacka: "{{email}}", popis: "e-mail, na který potvrzení odešlo", povinna: true },
    ],
  },
}

/**
 * Výchozí znění = to, co v obchodě stálo napevno do 9. 11. 2026.
 *
 * Mění se tady jen při změně kódu; co nastaví majitelka, leží v nastavení
 * obchodu a tohle nepřepisuje.
 */
export const SHOP_TEXT_DEFAULTS: Readonly<ShopTextValues> = Object.freeze({
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
})

/** Jen známé klíče se string hodnotou — co přijde navíc, se zahodí. */
export const pickStoredShopTexts = (value: unknown): StoredShopTexts => {
  const out: StoredShopTexts = {}
  if (!value || typeof value !== "object" || Array.isArray(value)) return out
  const source = value as Record<string, unknown>
  for (const key of SHOP_TEXT_KEYS) {
    const stored = source[key]
    if (
      Object.prototype.hasOwnProperty.call(source, key) &&
      typeof stored === "string"
    ) {
      out[key] = stored
    }
  }
  return out
}

/**
 * Platné hodnoty z uloženého objektu:
 * - klíč chybí → výchozí znění,
 * - `""` → prázdno, větu neukazovat (vědomé rozhodnutí majitelky),
 * - jinak oříznutý text.
 *
 * Nikdy nevyhodí — čte se při každém načtení stránky výrobku.
 */
export const resolveShopTexts = (stored: unknown): ShopTextValues => {
  const out: ShopTextValues = { ...SHOP_TEXT_DEFAULTS }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out
  const source = stored as Record<string, unknown>
  for (const key of SHOP_TEXT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = source[key]
    if (typeof value === "string") out[key] = value.trim()
  }
  return out
}

/** Platí po změně tytéž texty jako před ní? */
export const sameShopTexts = (a: unknown, b: unknown): boolean => {
  const left = resolveShopTexts(a)
  const right = resolveShopTexts(b)
  return SHOP_TEXT_KEYS.every((key) => left[key] === right[key])
}

/**
 * Proč text nejde uložit (česky, pro formulář i pro zápis), nebo `null`.
 *
 * Prázdné pole projde vždy — znamená „větu neukazovat". Povinná značka ale
 * chybět nesmí: věta o dokončení bez `{{dny}}` by zamlčela lhůtu, a to je
 * přesně ten údaj, kvůli kterému se text upravuje.
 */
export const shopTextProblem = (key: ShopTextKey, value: string): string | null => {
  const meta = SHOP_TEXT_META[key]
  const text = value.trim()
  if (text.length > meta.maxLength) {
    return `„${meta.label}“ smí mít nejvýš ${meta.maxLength} znaků (má ${text.length}).`
  }
  if (!text) return null
  for (const znacka of meta.znacky ?? []) {
    if (znacka.povinna && !text.includes(znacka.znacka)) {
      return `„${meta.label}“ musí obsahovat ${znacka.znacka} — ${znacka.popis}.`
    }
  }
  return null
}

/**
 * Dosadí za značky skutečné hodnoty. Co se nedodá, zůstane nenahrazené —
 * raději ať je v textu vidět `{{dny}}`, než aby věta tiše tvrdila nesmysl.
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
