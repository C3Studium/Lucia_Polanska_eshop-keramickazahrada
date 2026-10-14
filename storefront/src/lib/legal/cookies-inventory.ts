/**
 * Skutečný soupis cookies a úložišť, které web používá — zdroj tabulky na
 * stránce Cookies (§ 89 odst. 3 zákona 127/2005 Sb.). Při přidání nové
 * cookie / klíče v úložišti ji zapiš SEM, jinak stránka lže.
 *
 * Kategorie odpovídají liště souhlasu (`modules/layout/CookieNotice/categories.ts`):
 * nezbytné cookies souhlas nepotřebují, ostatní se nastaví jen po souhlasu.
 */

export type CookieCategory = "necessary" | "preferences" | "analytics" | "marketing"

export type CookieEntry = {
  /** Název cookie nebo klíče v úložišti prohlížeče. */
  name: string
  /** „cookie" | „localStorage" | „sessionStorage" */
  storage: "cookie" | "localStorage" | "sessionStorage"
  category: CookieCategory
  /** K čemu slouží — jedna věta pro zákazníka. */
  purpose: string
  /** Kdo ji nastavuje: „Keramická zahrada" nebo třetí strana. */
  provider: string
  /** Jak dlouho vydrží. */
  duration: string
  /** Jen pro administraci / redakci — běžný zákazník ji nedostane. */
  staffOnly?: boolean
}

export const COOKIE_INVENTORY: CookieEntry[] = [
  {
    name: "_medusa_cart_id",
    storage: "cookie",
    category: "necessary",
    purpose: "Pamatuje si váš košík, aby se při procházení obchodu neztratil.",
    provider: "Keramická zahrada",
    duration: "7 dní",
  },
  {
    name: "_medusa_express_cart_id",
    storage: "cookie",
    category: "necessary",
    purpose: "Košík rychlého nákupu jednoho výrobku.",
    provider: "Keramická zahrada",
    duration: "1 den",
  },
  {
    name: "_medusa_jwt",
    storage: "cookie",
    category: "necessary",
    purpose: "Udrží vás přihlášené do zákaznického účtu.",
    provider: "Keramická zahrada",
    duration: "7 dní",
  },
  {
    name: "_medusa_cache_id",
    storage: "cookie",
    category: "necessary",
    purpose: "Technický identifikátor, aby se vám zobrazovaly aktuální ceny a dostupnost.",
    provider: "Keramická zahrada",
    duration: "24 hodin",
  },
  {
    name: "kz-cookie-consent",
    storage: "cookie",
    category: "necessary",
    purpose: "Ukládá, jaké cookies jste povolili nebo odmítli.",
    provider: "Keramická zahrada",
    duration: "6 měsíců",
  },
  {
    name: "kz:build-stamp, kz:build-stamp-reloaded",
    storage: "localStorage",
    category: "necessary",
    purpose: "Pozná novou verzi webu, aby se košík nerozbil po aktualizaci.",
    provider: "Keramická zahrada",
    duration: "do smazání v prohlížeči",
  },
  {
    name: "kz:cart-version-pending, shop:snapshot, order-edit-draft:*, kz:shaders-demoted",
    storage: "sessionStorage",
    category: "necessary",
    purpose:
      "Dočasné údaje během návštěvy — rozpracovaná úprava objednávky, poloha ve výpisu obchodu, plynulost animací.",
    provider: "Keramická zahrada",
    duration: "do zavření okna",
  },
  {
    name: "kz-banner-dismissed:*",
    storage: "localStorage",
    category: "necessary",
    purpose: "Pamatuje si, že jste zavřeli informační pruh, aby se znovu neukazoval.",
    provider: "Keramická zahrada",
    duration: "do smazání v prohlížeči",
  },
  {
    name: "kz_last_payment_method",
    storage: "localStorage",
    category: "preferences",
    purpose: "Předvyplní při příštím nákupu způsob platby, který jste použili naposledy.",
    provider: "Keramická zahrada",
    duration: "do odvolání souhlasu",
  },
  {
    name: "kz_admin, kz_admin_hint, kz-admin-bar-hidden",
    storage: "cookie",
    category: "necessary",
    purpose: "Přihlášení majitelky obchodu do administrace.",
    provider: "Keramická zahrada",
    duration: "relace / do odhlášení",
    staffOnly: true,
  },
  {
    name: "cms_session, cms_hint",
    storage: "cookie",
    category: "necessary",
    purpose: "Přihlášení do redakčního systému webu.",
    provider: "Keramická zahrada",
    duration: "relace / do odhlášení",
    staffOnly: true,
  },
]
