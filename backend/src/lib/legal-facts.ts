/**
 * Právní údaje — fakta, která se dosazují za `{{klíč}}` do obchodních
 * podmínek, poučení, zásad, pokladny a e-mailů.
 *
 * ## Kde žijí
 *
 * Vyplňuje je majitelka v administraci („Právní údaje",
 * `admin/routes/pravni-udaje`); ukládají se do nastavení obchodu
 * (`store.metadata.merchant_settings.legal_facts`, viz `merchant-settings.ts`)
 * a web je čte přes `GET /store/legal/facts`. Patří k obchodu, ne do CMS:
 * čte je i backend (patička e-mailů, storno podmínky v potvrzení rezervace)
 * a nesmí záviset na tom, jestli Studio běží.
 *
 * Výchozí hodnoty jsou TOTÉŽ co `FACTS` ve storefrontu
 * (`storefront/src/lib/legal/facts.ts`, záloha webu pro výpadek backendu) —
 * test `legal-facts.unit.spec.ts` čte ten soubor a hlídá, aby se obě kopie
 * nerozjely. `null` = nevyplněno: web na tom místě ukáže žluté
 * `[[DOPLNIT: …]]`, e-mail údaj vynechá. Nikdy sem nedávat odhad — zvlášť ne
 * číslo účtu nebo údaj o DPH.
 *
 * ## Bez importů
 *
 * Čte to i administrace (Vite bundle v prohlížeči) a React Email šablony.
 * Import čehokoli z frameworku by do adminu zatáhl celý serverový strom
 * (viz komentář v `admin/routes/obsah/page.tsx`).
 */

/** Všechny klíče — stejné pořadí jako `FACTS` ve storefrontu. */
export const LEGAL_FACT_KEYS = [
  "seller.name",
  "seller.address",
  "seller.ico",
  "seller.register",
  "seller.email",
  "seller.phone",
  "seller.web",
  "seller.webUrl",
  "bank.account",
  "vat.status",
  "mto.deposit",
  "course.cancellation",
  "voucher.validity",
  "voucher.remainder",
  "privacy.newsletterTool",
  "privacy.hosting",
  "withdrawal.returnCostEstimate",
  "course.minAge",
  "course.pickupDeadline",
  "delivery.dispatchTime",
] as const

export type LegalFactKey = (typeof LEGAL_FACT_KEYS)[number]

/** Hodnoty všech údajů — `null` = nevyplněno. */
export type LegalFactValues = Record<LegalFactKey, string | null>

/**
 * Co je uložené v nastavení: jen vyplněné klíče; `""` = výslovně nevyplněno.
 * Chybějící klíč = výchozí hodnota z `LEGAL_FACT_DEFAULTS`.
 */
export type StoredLegalFacts = Partial<Record<LegalFactKey, string>>

/**
 * Výchozí hodnoty = `FACTS` storefrontu (zadání „Fakta od zadavatele",
 * 14. 10. 2026). Identita prodávající a dodací lhůta jsou potvrzené, zbytek
 * čeká na Lucii (docs/legal/OPEN_QUESTIONS.md).
 */
export const LEGAL_FACT_DEFAULTS: Readonly<LegalFactValues> = Object.freeze({
  "seller.name": "Lucie Polanská",
  "seller.address": "Putim 229, 397 01 Písek",
  "seller.ico": "03441482",
  /*
   * Úřad, který vede živnostenský rejstřík (§ 435 OZ — údaj o zápisu patří
   * na obchodní listiny, a potvrzení smlouvy jí je).
   *
   * Potvrzeno 24. 10. 2026 (OPEN_QUESTIONS N5): týž úřad, který na webu
   * uvádějí obchodní podmínky („zapsaná v živnostenském rejstříku vedeném
   * Městským úřadem Písek"). Sedmý pád schválně — dokument skládá větu
   * „…rejstříku vedeném {hodnota}" (lib/potvrzeni-zakazky/fields.ts).
   */
  "seller.register": "Městským úřadem Písek",
  /*
   * Kontaktní adresa prodávající v právních dokumentech (24. 10. 2026).
   *
   * Je to adresa, na kterou zákazník posílá odstoupení od smlouvy a
   * reklamaci, takže musí fungovat DNES — proto osobní Gmail, ne
   * `lucie@keramickazahrada.cz`, který teprve vznikne. Až bude doménová
   * schránka založená a ověřená, přepíše se to v administraci →
   * Právní údaje; kód se kvůli tomu měnit nemusí.
   */
  "seller.email": "lucie.polanska@gmail.com",
  "seller.phone": "+420 775 211 578",
  "seller.web": "keramickazahrada.cz",
  "seller.webUrl": "https://keramickazahrada.cz",
  "bank.account": null,
  "vat.status": null,
  "mto.deposit": null,
  "course.cancellation": null,
  "voucher.validity": null,
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "voucher.remainder":
    "zbytek hodnoty zůstává na poukazu a můžete ho využít při dalším nákupu do konce jeho platnosti",
  "privacy.newsletterTool": null,
  // Ověřeno 16. 10. 2026 — viz storefront/src/lib/legal/facts.ts.
  "privacy.hosting":
    "Railway Corporation, San Francisco, USA — aplikace obchodu a databáze běží v jejím datovém centru v Amsterdamu (Nizozemsko); Cloudflare, Inc., San Francisco, USA — soubory ukládá v úložišti R2 omezeném na Evropskou unii; Supabase Pte. Ltd., Singapur — obsah webu ukládá v datovém centru ve Frankfurtu nad Mohanem (Německo)",
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "withdrawal.returnCostEstimate":
    "150 až 250 Kč za křehký balík Českou poštou",
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "course.minAge":
    "6 let (mladší děti s doprovodem rodiče)",
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "course.pickupDeadline":
    "1 měsíce od kurzu, termín si domluvíme; mimo Písek je můžu poslat poštou",
  // Převzato z dosavadní veřejné stránky Doprava a platba (tentýž slib je
  // v OP čl. VII) — není to odhad; potvrzení je v OPEN_QUESTIONS (3a).
  "delivery.dispatchTime":
    "předáváme dopravci do 3 pracovních dnů od přijetí platby (u dobírky od objednávky), doručení pak obvykle trvá 1 až 3 pracovní dny",
})

/** Skupiny formuláře v pořadí, v jakém je stránka ukazuje. */
export const LEGAL_FACT_GROUPS = [
  "Prodávající",
  "Platby a DPH",
  "Doprava a vrácení",
  "Zakázky",
  "Kurzy",
  "Dárkové poukazy",
  "Osobní údaje",
] as const

export type LegalFactGroup = (typeof LEGAL_FACT_GROUPS)[number]

export type LegalFactMeta = {
  /** Název pole ve formuláři. */
  label: string
  /**
   * Nápověda pro majitelku: co to je a kde se to na webu / v e-mailu ukáže
   * (s větou, do které se údaj dosazuje — ať je vidět, jak má odpověď znít).
   */
  help: string
  /** Příklad dobré odpovědi — formulář ho ukáže pod nápovědou a v prázdném poli. */
  example: string
  group: LegalFactGroup
  /** Delší text → víceřádkové pole. Na webu se i tak sází do jednoho odstavce. */
  multiline: boolean
  /** Strop délky (znaky); hlídá ho formulář i zápis do nastavení. */
  maxLength: number
  /** Tvar, který se kontroluje při uložení (prázdné pole projde vždy). */
  format?: "email" | "url"
}

/*
 * Nápovědy citují skutečné věty z textů (storefront `lib/legal/documents/**`,
 * `lib/legal/faq.ts`, pokladna, stránka Kurzy). Když se věta v dokumentu
 * změní, opravit i tady — jinak nápověda radí odpověď, která do věty nesedí.
 */
export const LEGAL_FACT_META: Record<LegalFactKey, LegalFactMeta> = {
  "seller.name": {
    label: "Jméno prodávající",
    help:
      "Kdo prodává — vaše jméno jako podnikatelky, ne název obchodu. Stojí v obchodních podmínkách („Prodávající je …, podnikající fyzická osoba“), v poučení o odstoupení, reklamačním řádu, zásadách ochrany osobních údajů, v posledním kroku pokladny, na reklamačním protokolu a v patičce každého e-mailu.",
    example: "Lucie Polanská",
    group: "Prodávající",
    multiline: false,
    maxLength: 120,
  },
  "seller.address": {
    label: "Adresa sídla",
    help:
      "Adresa, kterou máte v živnostenském rejstříku, jedním řádkem. Je v obchodních podmínkách („…se sídlem …“), jako adresa pro dopisy a vracení zboží, jako adresa osobního vyzvednutí v ateliéru (i v e-mailu „připraveno k vyzvednutí“), v pokladně a v patičce e-mailů.",
    example: "Putim 229, 397 01 Písek",
    group: "Prodávající",
    multiline: false,
    maxLength: 200,
  },
  "seller.register": {
    label: "Zápis v rejstříku — úřad",
    help:
      "Který živnostenský úřad vede zápis, například Městský úřad Písek. § 435 občanského zákoníku chce na obchodních listinách — a potvrzení smlouvy jí je — údaj o zápisu do veřejného rejstříku. Bez tohoto údaje uvede dokument zápis bez úřadu.",
    example: "Městský úřad Písek",
    group: "Prodávající",
    multiline: false,
    maxLength: 120,
  },
  "seller.ico": {
    label: "IČO",
    help:
      "Identifikační číslo z živnostenského rejstříku — v obchodních podmínkách, reklamačním řádu, zásadách, v pokladně, na reklamačním protokolu a v patičce e-mailů i newsletteru. Jen číslo.",
    example: "03441482",
    group: "Prodávající",
    multiline: false,
    maxLength: 20,
  },
  "seller.email": {
    label: "Kontaktní e-mail",
    help:
      "Kam vám zákazníci píšou — odstoupení od smlouvy, reklamace, stížnosti i dotazy k osobním údajům („Napište nám na …“). Je ve všech právních dokumentech, v pokladně a v patičce e-mailů; na tuhle adresu jdou i odpovědi na potvrzení poptávky zakázky.",
    example: "info@keramickazahrada.cz",
    group: "Prodávající",
    multiline: false,
    maxLength: 120,
    format: "email",
  },
  "seller.phone": {
    label: "Telefon",
    help:
      "Telefon pro zákazníky, s předvolbou. Je v obchodních podmínkách (kontakty, rušení rezervace kurzu „…nebo telefonicky na …“), v poučení o odstoupení, reklamačním řádu, zásadách a v patičce e-mailů.",
    example: "+420 775 211 578",
    group: "Prodávající",
    multiline: false,
    maxLength: 40,
  },
  "seller.web": {
    label: "Doména obchodu",
    help:
      "Adresa obchodu tak, jak se čte v textu — bez https://. Například v obchodních podmínkách: „…když nakupujete v internetovém obchodě …“ a v reklamačním řádu.",
    example: "keramickazahrada.cz",
    group: "Prodávající",
    multiline: false,
    maxLength: 120,
  },
  "seller.webUrl": {
    label: "Celá adresa obchodu (odkaz)",
    help:
      "Stejná adresa jako odkaz, i s https://. Použije se v poučení o odstoupení („Na naší internetové stránce … můžete odstoupit online“) a v PDF dokumentů.",
    example: "https://keramickazahrada.cz",
    group: "Prodávající",
    multiline: false,
    maxLength: 200,
    format: "url",
  },
  "bank.account": {
    label: "Číslo bankovního účtu",
    help:
      "Účet, na který se výjimečně platí převodem, když se na tom domluvíte. V obchodních podmínkách: „Převodem na náš účet … se platí jen tehdy, když se na tom výslovně domluvíme“ a na stránce Doprava a platba („…zaplatit i převodem na náš účet …“). Staré podmínky uváděly 2500675505/2010 a 2701281289/2010, stará stránka Doprava 7010757121/2010 — napište ten, který opravdu platí; IBAN můžete připsat do závorky.",
    example: "1234567890/2010 (IBAN CZ00 2010 0000 0012 3456 7890)",
    group: "Platby a DPH",
    multiline: false,
    maxLength: 200,
  },
  "vat.status": {
    label: "DPH",
    help:
      "Jste plátce DPH? V obchodních podmínkách stojí věta „Daň z přidané hodnoty: ….“ — napište její druhou půlku. Pozor: obchod i faktury dnes počítají s tím, že plátcem nejste. Kdyby to bylo jinak, řekněte to Matějovi, změna se týká i cen a faktur.",
    example: "nejsme plátci DPH",
    group: "Platby a DPH",
    multiline: false,
    maxLength: 200,
  },
  "delivery.dispatchTime": {
    label: "Dodací lhůta zboží skladem",
    help:
      "Za jak dlouho zboží skladem odešlete a za jak dlouho dojde. Zákazník to vidí v posledním kroku pokladny, těsně před zaplacením: „Zboží skladem: ….“ Musí sedět s tím, co slibují obchodní podmínky (dodání zboží).",
    example:
      "předáváme dopravci zpravidla do 2 pracovních dnů od přijetí platby (u dobírky od objednávky), doručení pak obvykle trvá 1 až 3 pracovní dny",
    group: "Doprava a vrácení",
    multiline: true,
    maxLength: 400,
  },
  "withdrawal.returnCostEstimate": {
    label: "Odhad nákladů na vrácení zboží",
    help:
      "Kolik zákazník zhruba zaplatí za poslání zboží zpět, když odstoupí od smlouvy — zákon chce, aby to věděl předem. V obchodních podmínkách: „…počítejte s náklady přibližně …“ a v poučení o odstoupení: „Počítejte přibližně s částkou ….“",
    example: "150 až 250 Kč za křehký balík Českou poštou",
    group: "Doprava a vrácení",
    multiline: false,
    maxLength: 200,
  },
  "mto.deposit": {
    label: "Výše zálohy u zakázky",
    help:
      "Kolik se u výrobku na zakázku platí předem. V obchodních podmínkách: „Při objednávce zaplatíte zálohu ve výši … ceny výrobku …, nejvýše však 50 % ceny“ a v častých dotazech („…zaplatíte zálohu … ceny, nejvýš polovinu“). Napište procenta. Zálohu, kterou obchod opravdu účtuje, určuje profil výroby u produktu — obojí musí sedět.",
    example: "40 %",
    group: "Zakázky",
    multiline: false,
    maxLength: 60,
  },
  "course.cancellation": {
    label: "Storno podmínky kurzů",
    help:
      "Co se stane, když zákazník zruší rezervaci kurzu. Text se ukáže v obchodních podmínkách („Storno podmínky: …“), na stránce Kurzy, v okně rezervace (nad tlačítkem rezervace), v častých dotazech a v e-mailu s potvrzením rezervace. Pište souvislý text, klidně několik vět. Dnes obchod dovolí zrušit rezervaci online nejpozději 24 hodin před kurzem a vrátí celou částku; později jen telefonicky — když napíšete jiné pravidlo, řekněte Matějovi, ať upraví i automatické vracení peněz.",
    example:
      "Rezervaci můžete zrušit zdarma nejpozději 7 dní před kurzem. Při zrušení 2 až 6 dní předem vracíme polovinu ceny, nebo vám nabídneme jiný termín. Později už peníze nevracíme, můžete ale poslat náhradníka.",
    group: "Kurzy",
    multiline: true,
    maxLength: 2000,
  },
  "course.minAge": {
    label: "Minimální věk dítěte na kurzu",
    help:
      "Od kolika let může dítě na kurz. V obchodních podmínkách, na stránce Kurzy a v častých dotazech: „Minimální věk dítěte: ….“",
    example: "6 let",
    group: "Kurzy",
    multiline: false,
    maxLength: 60,
  },
  "course.pickupDeadline": {
    label: "Lhůta na vyzvednutí výrobků z kurzu",
    help:
      "Do kdy si má zákazník vyzvednout vypálené výrobky. V obchodních podmínkách a na stránce Kurzy: „…vyzvednete si je v ateliéru do ….“ — dopište konec věty.",
    example: "3 měsíců od kurzu",
    group: "Kurzy",
    multiline: false,
    maxLength: 150,
  },
  "voucher.validity": {
    label: "Platnost dárkového poukazu",
    help:
      "Jak dlouho poukaz platí. V obchodních podmínkách: „Platnost: … od data nákupu“ a v častých dotazech („Platnost: … od nákupu“). Stačí doba.",
    example: "12 měsíců",
    group: "Dárkové poukazy",
    multiline: false,
    maxLength: 100,
  },
  "voucher.remainder": {
    label: "Zůstatek poukazu",
    help:
      "Co se stane, když zákazník nakoupí za méně, než je hodnota poukazu. V obchodních podmínkách: „Je-li nákup dražší než hodnota poukazu, rozdíl doplatíte. Je-li levnější: ….“ — dopište druhou půlku věty.",
    example: "zbytek hodnoty zůstává na poukazu a můžete ho využít do konce jeho platnosti",
    group: "Dárkové poukazy",
    multiline: true,
    maxLength: 400,
  },
  "privacy.newsletterTool": {
    label: "Nástroj na rozesílku newsletteru",
    help:
      "Služba, přes kterou odchází newsletter. V zásadách ochrany osobních údajů je mezi příjemci údajů („nástroj na rozesílku newsletteru: …“) a v tabulce u řádku Newsletter. Dnes newsletter posílá obchod sám přes svou e-mailovou službu Resend.",
    example: "Resend (Plus Five Five, Inc., USA), přes který posíláme i ostatní e-maily",
    group: "Osobní údaje",
    multiline: false,
    maxLength: 300,
  },
  "privacy.hosting": {
    label: "Hosting a sídlo poskytovatelů",
    help:
      "Kde obchod technicky běží. V zásadách: „Hosting obchodu a sídlo jeho poskytovatelů: ….“ Jde o Railway (aplikace a databáze), Cloudflare R2 (soubory), Supabase (obsah webu) a Resend (e-maily) — doplňte jejich sídla, případně kde jsou servery, podle smluv.",
    example:
      "Railway Corporation, San Francisco, USA — aplikace a databáze v Amsterdamu; Cloudflare, Inc., USA — soubory v R2 v EU; Supabase Pte. Ltd., Singapur — obsah webu ve Frankfurtu",
    group: "Osobní údaje",
    multiline: true,
    maxLength: 800,
  },
}

export const isLegalFactKey = (key: string): key is LegalFactKey =>
  Object.prototype.hasOwnProperty.call(LEGAL_FACT_META, key)

/**
 * Jen to, co do uloženého objektu patří: známé klíče s textovou hodnotou.
 * Čtení nastavení přes to prožene i poškozený objekt — jeden špatný údaj
 * (nebo údaj delší, než dovolí pozdější zpřísnění limitu) tak nesmaže
 * ostatní.
 */
export const pickStoredLegalFacts = (raw: unknown): StoredLegalFacts => {
  const out: StoredLegalFacts = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  const source = raw as Record<string, unknown>
  for (const key of LEGAL_FACT_KEYS) {
    const value = source[key]
    if (Object.prototype.hasOwnProperty.call(source, key) && typeof value === "string") {
      out[key] = value
    }
  }
  return out
}

/**
 * Platné hodnoty z uloženého objektu `{ [klíč]: string }`:
 * - klíč chybí → výchozí hodnota (`LEGAL_FACT_DEFAULTS`),
 * - `""` / jen mezery (nebo `null`) → `null`, výslovně nevyplněno,
 * - jinak oříznutý text.
 *
 * Neznámé klíče se ignorují, hodnota jiného typu (poškozená) nechá výchozí.
 * Nikdy nevyhodí — čte se při každém e-mailu a každém načtení webu.
 */
export const resolveLegalFacts = (stored: unknown): LegalFactValues => {
  const out: LegalFactValues = { ...LEGAL_FACT_DEFAULTS }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out
  const source = stored as Record<string, unknown>
  for (const key of LEGAL_FACT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = source[key]
    if (value === null) out[key] = null
    else if (typeof value === "string") out[key] = value.trim() || null
  }
  return out
}

/** Klíče, které zatím nejsou vyplněné (na webu `[[DOPLNIT]]`), v pořadí formuláře. */
export const missingLegalFacts = (facts: LegalFactValues): LegalFactKey[] =>
  LEGAL_FACT_GROUPS.flatMap((group) =>
    LEGAL_FACT_KEYS.filter((key) => LEGAL_FACT_META[key].group === group && facts[key] === null)
  )

/** Platí po změně tytéž údaje jako před ní? (Porovnává výsledné hodnoty, ne uložený tvar.) */
export const sameLegalFacts = (a: unknown, b: unknown): boolean => {
  const left = resolveLegalFacts(a)
  const right = resolveLegalFacts(b)
  return LEGAL_FACT_KEYS.every((key) => left[key] === right[key])
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_SHAPE = /^https?:\/\/[^\s/]+\.[^\s]+$/i

/**
 * Proč hodnota nejde uložit (česky, pro formulář i zápis do nastavení),
 * nebo `null`, když je v pořádku. Prázdné pole je v pořádku vždy —
 * znamená „nevyplněno".
 */
export const legalFactProblem = (key: LegalFactKey, value: string): string | null => {
  const meta = LEGAL_FACT_META[key]
  const text = value.trim()
  if (text.length > meta.maxLength) {
    return `„${meta.label}“ smí mít nejvýš ${meta.maxLength} znaků (má ${text.length}).`
  }
  if (!text) return null
  if (meta.format === "email" && !EMAIL_SHAPE.test(text)) {
    return `„${meta.label}“ musí být e-mailová adresa, např. ${meta.example}.`
  }
  if (meta.format === "url" && !URL_SHAPE.test(text)) {
    return `„${meta.label}“ musí být celá adresa začínající https://, např. ${meta.example}.`
  }
  return null
}
