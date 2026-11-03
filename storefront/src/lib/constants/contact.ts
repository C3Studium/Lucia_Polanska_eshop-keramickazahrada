import { itemValue } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"

/**
 * Kontaktní e-maily ateliéru — dva, ne jeden (zadání Lucie, 2. 11. 2026).
 *
 * - `dotazy` — obecné otázky: kontaktní okno, newsletter, účet, patička, 404.
 * - `objednavky` — všechno, co se týká konkrétní objednávky nebo zakázky:
 *   úprava, zrušení, reklamace, odstoupení, platba, poukaz z objednávky.
 *   Na tuhle adresu Lucie odpovídá sama, takže tam zpráva k objednávce
 *   nečeká ve frontě obecných dotazů.
 *
 * Upravují se ve Studiu (blok `global.kontakty`, položky `email.dotazy`
 * a `email.objednavky`). Tohle jsou ZÁLOHY pro výpadek CMS a prázdné pole —
 * jediné místo v kódu, kde ty adresy stojí, včetně modulů, které běží na
 * klientovi a do serverové čtečky CMS nemůžou.
 *
 * Právní dokumenty sem nepatří: ty berou `seller.email` z „Právních údajů"
 * v administraci obchodu (identita prodávající na dokladech), viz `@lib/legal`.
 */
export const CONTACT_EMAILS = {
  dotazy: "info@keramickazahrada.cz",
  objednavky: "lucie.polanska@gmail.com",
} as const

export type ContactEmails = { dotazy: string; objednavky: string }

/** Klíč bloku ve Studiu a popisky položek — smlouva se seedem textů. */
export const CONTACT_EMAILS_BLOCK = "global.kontakty"
export const CONTACT_EMAIL_LABELS = {
  dotazy: "email.dotazy",
  objednavky: "email.objednavky",
} as const

/*
 * Jen hrubá kontrola tvaru. Překlep typu „info.keramickazahrada.cz" by jinak
 * rozeslal po webu `mailto:` odkazy, které nikam nevedou — a nikdo by se to
 * nedozvěděl, protože zákazník, kterému e-mail neodejde, se neozve. Záloha
 * z kódu je v tu chvíli menší zlo.
 */
const looksLikeEmail = (value: string | undefined): value is string =>
  !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/**
 * E-maily z bloku `global.kontakty`, chybějící nebo nesmyslné pole = záloha.
 *
 * Čistá funkce bez serveru: volá ji serverová čtečka (`getContactEmails`)
 * i klientská patička, která blok dostává propem.
 */
export const contactEmailsFrom = (block: CopyBlock | undefined): ContactEmails => {
  const read = (label: string, fallback: string) => {
    const value = itemValue(block, label)?.trim()
    return looksLikeEmail(value) ? value : fallback
  }
  return {
    dotazy: read(CONTACT_EMAIL_LABELS.dotazy, CONTACT_EMAILS.dotazy),
    objednavky: read(CONTACT_EMAIL_LABELS.objednavky, CONTACT_EMAILS.objednavky),
  }
}

/**
 * Stará jména — čtou je hlášky sdílené s klientem (`@lib/util/error-messages`),
 * které se do CMS nedostanou (synchronní funkce volaná z klienta i serveru).
 * Zůstávají na záloze, proto ji berou odsud a ne z vlastního řetězce.
 */
export const SUPPORT_EMAIL = CONTACT_EMAILS.dotazy
export const ORDER_EMAIL = CONTACT_EMAILS.objednavky
export const SUPPORT_PHONE = "+420 775 211 578"
export const SUPPORT_PHONE_DIAL = "+420775211578"
