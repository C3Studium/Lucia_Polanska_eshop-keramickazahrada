/**
 * Fakta pro právní texty — jediné místo, kde se zapisují údaje o prodávající.
 *
 * Hodnota `null` = zadavatel ji zatím nedodal. V textu se pak `{{klíč}}`
 * vykreslí jako zvýrazněné `[[DOPLNIT: …]]` s popisem z `missing` a otázka je
 * v docs/legal/OPEN_QUESTIONS.md. Nikdy sem nedávat odhad ani „rozumnou
 * výchozí hodnotu" — zvlášť ne číslo účtu nebo údaj o DPH.
 *
 * Zdroj potvrzených hodnot: zadání „Fakta od zadavatele" (14. 10. 2026).
 */

export type LegalFactKey = keyof typeof FACTS

export const FACTS = {
  "seller.name": "Lucie Polanská",
  "seller.address": "Putim 229, 397 01 Písek",
  "seller.ico": "03441482",
  "seller.email": "info@keramickazahrada.cz",
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
  "voucher.remainder": null,
  /** Nástroj na rozesílku newsletteru (zpracovatel pro Zásady). */
  "privacy.newsletterTool": null,
  /** Hosting / provozovatel infrastruktury a jeho sídlo (zpracovatel pro Zásady). */
  "privacy.hosting": null,
  /** Odhad nákladů na vrácení zboží poštou (§ 1820 odst. 1 písm. i) OZ). */
  "withdrawal.returnCostEstimate": null,
  /** Minimální věk dítěte na kurzu. */
  "course.minAge": null,
  /** Do kdy si vyzvednout výrobek z kurzu po výpalu. */
  "course.pickupDeadline": null,
  /**
   * Dodací lhůta zboží skladem (předsmluvní informace v posledním kroku
   * pokladny, § 1820 odst. 1 písm. g) OZ). Celá fráze, např. „odešleme do …".
   * Převzato z dosavadní veřejné stránky Doprava a platba (tentýž slib je
   * v OP čl. VII) — není to odhad; potvrzení je v OPEN_QUESTIONS.
   */
  "delivery.dispatchTime":
    "předáváme dopravci zpravidla do 2 pracovních dnů od přijetí platby (u dobírky od objednávky), doručení pak obvykle trvá 1 až 3 pracovní dny",
} as const satisfies Record<string, string | null>

/** Popis chybějícího údaje pro zvýrazněný zástupný text. */
const MISSING: Record<LegalFactKey, string> = {
  "seller.name": "jméno prodávající",
  "seller.address": "adresa sídla",
  "seller.ico": "IČO",
  "seller.email": "e-mail",
  "seller.phone": "telefon",
  "seller.web": "doména obchodu",
  "seller.webUrl": "adresa obchodu",
  "bank.account":
    "číslo účtu — OP uvádí 2500675505/2010 a 2701281289/2010, stránka Doprava 7010757121/2010",
  "vat.status": "plátce DPH ano/ne",
  "mto.deposit": "výše zálohy u zakázky v %, doporučeno 30–50 %",
  "course.cancellation":
    "storno podmínky kurzů, doporučeno: 7 a více dní předem 100 %, 2–6 dní 50 % nebo přesun, méně než 48 h 0 %",
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

/** Hodnota faktu, nebo `null` když chybí. */
export const fact = (key: LegalFactKey): string | null => FACTS[key] ?? null

/** Text zástupného údaje pro chybějící fakt (bez závorek). */
export const missingFactLabel = (key: LegalFactKey): string => MISSING[key]

export const isFactKey = (key: string): key is LegalFactKey =>
  Object.prototype.hasOwnProperty.call(FACTS, key)
