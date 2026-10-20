/**
 * Skutečný soupis cookies a úložišť, které web používá — zdroj tabulky na
 * stránce Cookies (§ 89 odst. 3 zákona 127/2005 Sb.). Při přidání nové
 * cookie / klíče v úložišti ji zapiš SEM, jinak stránka lže.
 *
 * Kategorie odpovídají liště souhlasu (`modules/layout/CookieNotice/categories.ts`):
 * nezbytné cookies souhlas nepotřebují, ostatní se nastaví jen po souhlasu.
 *
 * Ověřeno 14. 10. 2026 proti kódu storefrontu (`document.cookie`, `cookies().set`,
 * `response.cookies.set`, `localStorage.setItem`, `sessionStorage.setItem`, vložený
 * skript `bootResetScript`) a balíku ValeCMS 0.1.52. Položky s `thirdParty: true`
 * nejsou naše cookies — leží na doméně třetí strany, která je nastavuje ve svém
 * okně (iframe) nebo na své stránce; jejich přesný seznam a dobu určuje ona.
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
  /**
   * Cookie třetí strany na JEJÍ doméně (mapa, výběr výdejního místa, platební
   * brána) — ne naše. Tabulka by ji měla tak i označit.
   */
  thirdParty?: boolean
  /** Kdy se nastaví / doplňující věta pro zákazníka (např. „jen po kliknutí na …"). */
  note?: string
}

/** Názvy kategorií, jak je ukazuje lišta (`CookieNotice/categories.ts`). */
export const COOKIE_CATEGORY_LABELS: Record<CookieCategory, string> = {
  necessary: "Nezbytné",
  preferences: "Preferenční",
  analytics: "Analytické",
  marketing: "Marketingové a obsah třetích stran",
}

export const COOKIE_INVENTORY: CookieEntry[] = [
  // ── Nezbytné — naše ─────────────────────────────────────────────────────
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
    purpose:
      "Ukládá, jaké cookies jste povolili nebo odmítli, a kdy jste se rozhodli.",
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

  // ── Nezbytné — třetí strany (bez nich nejde vybrat doručení ani zaplatit) ─
  // Zásilkovna: pokladna ji umí, ale není zapnutá a zapínat se nebude (Matěj 20. 10. 2026) —
  // její widget se nenačítá, v soupisu proto není.
  {
    name: "cookies České pošty (b2c.cpost.cz)",
    storage: "cookie",
    category: "necessary",
    purpose:
      "Mapa výdejních míst Balíkovny, ze které si v pokladně nebo při změně doručení vybíráte výdejnu.",
    provider: "Česká pošta, s.p.",
    duration: "určuje Česká pošta",
    thirdParty: true,
    note:
      "Načte se jen tehdy, když zvolíte doručení do Balíkovny. Mapa patří České poště a může si ukládat vlastní cookies.",
  },
  {
    name: "cookies platební brány ComGate (payments.comgate.cz)",
    storage: "cookie",
    category: "necessary",
    purpose:
      "Průběh platby kartou nebo převodem na stránce platební brány, kam vás při placení přesměrujeme.",
    provider: "Comgate a.s.",
    duration: "určuje ComGate",
    thirdParty: true,
    note:
      "Nejsou to naše cookies — nastavuje je ComGate na své doméně, jen když u objednávky platíte online.",
  },

  // ── Preferenční ──────────────────────────────────────────────────────────
  {
    name: "kz_last_payment_method",
    storage: "localStorage",
    category: "preferences",
    purpose: "Předvyplní při příštím nákupu způsob platby, který jste použili naposledy.",
    provider: "Keramická zahrada",
    duration: "do odvolání souhlasu",
    note: "Jen s preferenčním souhlasem; po jeho odvolání se hned smaže.",
  },

  // ── Analytické ───────────────────────────────────────────────────────────
  {
    name: "_ga",
    storage: "cookie",
    category: "analytics",
    purpose:
      "Google Analytics 4: rozliší jednotlivé prohlížeče, abychom viděli, kolik lidí obchod navštěvuje a jak jím prochází.",
    provider: "Google Ireland Ltd.",
    duration: "2 roky",
    note:
      "Jen pokud měření na webu právě používáme a vy jste povolili analytické cookies. Při odvolání souhlasu ji smažeme.",
  },
  {
    name: "_ga_<ID>",
    storage: "cookie",
    category: "analytics",
    purpose:
      "Google Analytics 4: drží stav jedné návštěvy (relace), aby se stránky jedné návštěvy počítaly dohromady.",
    provider: "Google Ireland Ltd.",
    duration: "2 roky",
    note:
      "Jen pokud měření na webu právě používáme a vy jste povolili analytické cookies. Při odvolání souhlasu ji smažeme.",
  },

  // ── Marketingové a obsah třetích stran ───────────────────────────────────
  {
    name: "cookies Google (NID, AEC, SOCS a další na google.com)",
    storage: "cookie",
    category: "marketing",
    purpose:
      "Mapa Google s polohou ateliéru v kontaktním okně. Google si v ní pamatuje nastavení a cookies může použít i pro reklamu.",
    provider: "Google Ireland Ltd.",
    duration: "určuje Google (obvykle 6 až 13 měsíců)",
    thirdParty: true,
    note:
      "Mapa se načte až po kliknutí na „Zobrazit mapu“, nebo rovnou, pokud jste povolili marketingové cookies. Do té doby se z Googlu nestahuje nic.",
  },

  // ── Jen pro majitelku a redakci ──────────────────────────────────────────
  {
    name: "kz_admin, kz_admin_hint",
    storage: "cookie",
    category: "necessary",
    purpose: "Přihlášení majitelky obchodu do administrace.",
    provider: "Keramická zahrada",
    duration: "relace / do odhlášení",
    staffOnly: true,
  },
  {
    name: "kz-admin-bar-hidden",
    storage: "localStorage",
    category: "necessary",
    purpose: "Pamatuje si, jestli majitelka skryla lištu administrace.",
    provider: "Keramická zahrada",
    duration: "do smazání v prohlížeči",
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
  {
    name: "cms.studio.sidebar.collapsed, cms.studio.preview.view, valecms.studio.advice",
    storage: "localStorage",
    category: "necessary",
    purpose: "Rozložení redakčního systému (sbalený panel, náhled) a skryté nápovědy.",
    provider: "Keramická zahrada",
    duration: "do smazání v prohlížeči",
    staffOnly: true,
  },
  {
    name: "cms.manage.dismissed",
    storage: "sessionStorage",
    category: "necessary",
    purpose: "Pamatuje si, že redaktor zavřel odznak pro úpravy webu.",
    provider: "Keramická zahrada",
    duration: "do zavření okna",
    staffOnly: true,
  },
]
