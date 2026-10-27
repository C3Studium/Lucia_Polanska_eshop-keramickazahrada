/**
 * Fakta pro právní texty — údaje o prodávající, které se dosazují za `{{klíč}}`.
 *
 * Údaje se vyplňují v administraci obchodu (Medusa → „Právní údaje",
 * `store.metadata.merchant_settings.legal_facts`) a web je čte přes
 * `GET /store/legal/facts` (`@lib/data/legal-facts` → `getLegalFacts()`).
 * Tenhle soubor je jen ZÁLOHA pro chvíli, kdy backend neodpovídá, a výchozí
 * hodnota testů — stejné hodnoty má backend jako výchozí
 * (`backend/src/lib/legal-facts.ts`).
 *
 * Hodnota `null` = zadavatel ji zatím nedodal. V textu se pak `{{klíč}}`
 * vykreslí jako zvýrazněné `[[DOPLNIT: …]]` s popisem z `missing` a otázka je
 * v docs/legal/OPEN_QUESTIONS.md. Nikdy sem nedávat odhad ani „rozumnou
 * výchozí hodnotu" — zvlášť ne číslo účtu nebo údaj o DPH.
 *
 * Zdroj potvrzených hodnot: zadání „Fakta od zadavatele" (14. 10. 2026).
 */

export type LegalFactKey = keyof typeof FACTS

/** Hodnoty všech faktů — `null` = nevyplněno (vykreslí se jako `[[DOPLNIT]]`). */
export type LegalFacts = Record<LegalFactKey, string | null>

export const FACTS = {
  "seller.name": "Lucie Polanská",
  "seller.address": "Putim 229, 397 01 Písek",
  "seller.ico": "03441482",
  /* Úřad vedoucí živnostenský rejstřík (§ 435 OZ — údaj o zápisu patří na
     obchodní listiny). Čeká na potvrzení, OPEN_QUESTIONS N5. */
  "seller.register": null,
  /*
   * Kontakt prodávající v právních dokumentech (24. 10. 2026). Adresa pro
   * odstoupení od smlouvy a reklamaci — musí fungovat dnes, proto osobní
   * Gmail, ne `lucie@keramickazahrada.cz`, který teprve vznikne.
   * Zákaznická podpora e-shopu zůstává na `info@keramickazahrada.cz`
   * (viz lib/constants/contact.ts) — to je jiná role než právní kontakt.
   */
  "seller.email": "lucie.polanska@gmail.com",
  "seller.phone": "+420 775 211 578",
  "seller.web": "keramickazahrada.cz",
  "seller.webUrl": "https://keramickazahrada.cz",
  /** Číslo účtu — v OP dnes 2500675505/2010 a 2701281289/2010, na Dopravě 7010757121/2010. */
  "bank.account": null,
  /** Plátce DPH ano/ne. Kód obchodu (PLATCE_DPH=false) i iDoklad dnes počítají s neplátcem — nepotvrzeno. */
  "vat.status": null,
  /** Výše zálohy u zakázky (% z ceny). Doporučeno 30–50 %. */
  "mto.deposit": null,
  /** Storno podmínky kurzů. */
  "course.cancellation": null,
  /** Platnost dárkového poukazu (dnes uváděn 1 rok jen u „volné“ varianty). */
  "voucher.validity": null,
  /** Co se stane se zůstatkem poukazu při nákupu pod jeho hodnotu. */
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "voucher.remainder":
    "zbytek hodnoty zůstává na poukazu a můžete ho využít při dalším nákupu do konce jeho platnosti",
  /** Nástroj na rozesílku newsletteru (zpracovatel pro Zásady). */
  "privacy.newsletterTool": null,
  /** Hosting / provozovatel infrastruktury a jeho sídlo (zpracovatel pro Zásady). */
  /** Ověřeno 16. 10. 2026 (Railway region europe-west4, R2 endpoint .eu, Supabase eu-central-1). */
  "privacy.hosting":
    "Railway Corporation, San Francisco, USA — aplikace obchodu a databáze běží v jejím datovém centru v Amsterdamu (Nizozemsko); Cloudflare, Inc., San Francisco, USA — soubory ukládá v úložišti R2 omezeném na Evropskou unii; Supabase Pte. Ltd., Singapur — obsah webu ukládá v datovém centru ve Frankfurtu nad Mohanem (Německo)",
  /** Odhad nákladů na vrácení zboží poštou (§ 1820 odst. 1 písm. i) OZ). */
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "withdrawal.returnCostEstimate":
    "150 až 250 Kč za křehký balík Českou poštou",
  /** Minimální věk dítěte na kurzu. */
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "course.minAge":
    "6 let (mladší děti s doprovodem rodiče)",
  /** Do kdy si vyzvednout výrobek z kurzu po výpalu. */
  // Odpovědi Lucie z 20. 10. 2026; odhad nákladů na vrácení potvrdil Matěj 24. 10.
  "course.pickupDeadline":
    "1 měsíce od kurzu, termín si domluvíme; mimo Písek je můžu poslat poštou",
  /**
   * Dodací lhůta zboží skladem (předsmluvní informace v posledním kroku
   * pokladny, § 1820 odst. 1 písm. g) OZ). Celá fráze, např. „odešleme do …".
   * Převzato z dosavadní veřejné stránky Doprava a platba (tentýž slib je
   * v OP čl. VII) — není to odhad; potvrzení je v OPEN_QUESTIONS.
   */
  "delivery.dispatchTime":
    "předáváme dopravci do 3 pracovních dnů od přijetí platby (u dobírky od objednávky), doručení pak obvykle trvá 1 až 3 pracovní dny",
} as const satisfies Record<string, string | null>

/** Popis chybějícího údaje pro zvýrazněný zástupný text. */
const MISSING: Record<LegalFactKey, string> = {
  "seller.name": "jméno prodávající",
  "seller.address": "adresa sídla",
  "seller.ico": "IČO",
  "seller.register": "úřad vedoucí živnostenský rejstřík",
  "seller.email": "e-mail",
  "seller.phone": "telefon",
  "seller.web": "doména obchodu",
  "seller.webUrl": "adresa obchodu",
  "bank.account":
    "číslo účtu — OP uvádí 2500675505/2010 a 2701281289/2010, stránka Doprava 7010757121/2010",
  "vat.status": "plátce DPH ano/ne",
  "mto.deposit": "výše zálohy u zakázky v %, doporučeno 30–50 %",
  "course.cancellation":
    "storno podmínky kurzů — online zrušení nejpozději 24 h před kurzem (celá částka zpět), později jen telefonicky",
  "voucher.validity": "platnost poukazu, dnes 1 rok",
  "voucher.remainder": "co se stane se zůstatkem poukazu, když nákup nedosáhne jeho hodnoty",
  "privacy.newsletterTool": "nástroj na rozesílku newsletteru",
  "privacy.hosting": "hosting a jeho sídlo",
  "withdrawal.returnCostEstimate": "odhad nákladů na vrácení zboží poštou v Kč",
  "course.minAge": "minimální věk dítěte na kurzu",
  "course.pickupDeadline": "do kdy si vyzvednout výrobek z kurzu",
  "delivery.dispatchTime":
    "dodací lhůta zboží skladem — stránka Doprava dnes uvádí „předáváme přepravci zpravidla do dvou pracovních dnů od přijetí platby“, doručení 1–3 pracovní dny",
}

/** Záložní fakty z kódu (když backend neodpovídá) — viz komentář nahoře. */
export const FALLBACK_FACTS: LegalFacts = { ...FACTS }

export const LEGAL_FACT_KEYS = Object.keys(FACTS) as LegalFactKey[]

/**
 * Hodnota faktu, nebo `null` když chybí. Bez `facts` se bere záloha z kódu —
 * vykreslování na webu má dostat fakty z `getLegalFacts()`.
 */
export const fact = (key: LegalFactKey, facts: LegalFacts = FALLBACK_FACTS): string | null =>
  facts[key] ?? null

/** Text zástupného údaje pro chybějící fakt (bez závorek). */
export const missingFactLabel = (key: LegalFactKey): string => MISSING[key]

export const isFactKey = (key: string): key is LegalFactKey =>
  Object.prototype.hasOwnProperty.call(FACTS, key)

/**
 * Fakty z odpovědi backendu sloučené přes zálohu: známé klíče, řetězec se
 * ořízne, prázdný = `null`. Klíč, který backend nevrátil, zůstane ze zálohy.
 */
export const mergeFacts = (
  incoming: Record<string, unknown> | null | undefined,
  base: LegalFacts = FALLBACK_FACTS
): LegalFacts => {
  const out: LegalFacts = { ...base }
  if (!incoming || typeof incoming !== "object") return out
  for (const key of LEGAL_FACT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue
    const value = incoming[key]
    if (value === null) out[key] = null
    else if (typeof value === "string") out[key] = value.trim() || null
  }
  return out
}
