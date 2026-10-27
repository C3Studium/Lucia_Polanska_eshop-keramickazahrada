/**
 * Ukázkové stránky pro Studio — stránky, které bez objednávky, tokenu,
 * rezervace, poukazu, košíku nebo přihlášení nejdou otevřít.
 *
 * ## Jak to funguje
 *
 * 1. `valecms.config.ts` z téhle tabulky udělá stránky Studia
 *    (`studioPreviewListed`): každá vyhrazená adresa (`/cz/order/ukazka/confirmed`)
 *    je v seznamu stránek pod svým jménem, s bloky textů, které čte (`copy`).
 * 2. `middleware.ts` vyhrazenou adresu přepíše na skutečnou stránku:
 *    - `fixed` — pevná adresa (stav newsletteru), bez dotazu a pro každého;
 *    - `target` / `account` / `legal` / `cart` — jen pro přihlášeného redaktora
 *      Studia (cookie `cms_session`, ověří `/api/studio/ukazka`), se skutečnými
 *      daty z obchodu. Adresa v rámu zůstane vyhrazená, texty jdou upravit jako
 *      kdekoli jinde.
 *    - bez ničeho z toho — stránka si poradí s jakýmkoli id (`ukazka`) sama.
 * 3. Komukoli jinému vyhrazená adresa s daty nic neukáže (404 / prázdný stav).
 *
 * Bez importů schválně: čte to konfigurace Studia, middleware (Edge) i serverová routa.
 *
 * ## Bezpečnost ukázek
 *
 * Žádná ukázka nesmí při otevření nic změnit:
 * - `/cart/:id/confirmed` při načtení dokončuje košík — pro id `ukazka` má
 *   stránka náhledový režim, který jen ukáže texty (`STUDIO_PREVIEW_ID`).
 * - převod objednávky (přijmout / odmítnout) s vymyšleným id a tokenem backend
 *   odmítne, takže se ukáže stav „neplatný odkaz" a nic se nezmění.
 * - „Přidat zboží" (`/order/:id/edit/pridat`) jde jen v rozběhnuté úpravě — bez ní
 *   přesměruje zpět na Úpravu objednávky, a rozběhnout úpravu by objednávku změnilo.
 *   `/refund?kind=odstoupeni` přesměruje na formulář odstoupení, který tu je.
 * - účet zákazníka se ukazuje s patnáctiminutovým tokenem jen v jednom
 *   vykreslení — prohlížeč redaktora ho nedostane, takže v účtu nejde jednat.
 */

/** Id, se kterým stránky poznají ukázku (a nic nedělají). */
export const STUDIO_PREVIEW_ID = "ukazka"

export type StudioPreviewRef = { id: string; token: string }

/** Tvar odpovědi backendu `GET /store/studio-preview` (backend/src/lib/studio-preview.ts). */
export type StudioPreviewData = {
  order: StudioPreviewRef | null
  commissionOrder: StudioPreviewRef | null
  priceOnRequestOrder: StudioPreviewRef | null
  awaitingBalanceOrder: StudioPreviewRef | null
  courseReservation: StudioPreviewRef | null
  paidVoucher: StudioPreviewRef | null
  pendingVoucher: StudioPreviewRef | null
  products: Record<
    "regular" | "madeToOrder" | "priceOnRequest" | "giftVoucher" | "clearance" | "soldOut",
    string | null
  >
  categoryHandle: string | null
  collectionHandle: string | null
}

export type StudioPreviewPage = {
  /** Vyhrazená adresa — tak ji zná Studio (bez `?`, Studio query v adrese nepustí). */
  path: string
  /** Jméno v seznamu stránek Studia. */
  title: string
  /** Bloky textů stránky (`page` u siteCopy), jako u ostatních stránek v konfiguraci. */
  copy: string | null
  /** Pevný přepis bez dat. */
  fixed?: string
  /** Přepis podle dat z obchodu; `null` = data chybí (vysvětlí se, co). */
  target?: (data: StudioPreviewData, country: string) => string | null
  /** Stránka účtu: přepis pro přihlášeného ukázkového zákazníka (id jeho objednávky). */
  account?: (orderId: string | null, country: string) => string | null
  /** Tisk právního dokumentu v aktuálně platném znění. */
  legal?: string
  /** Co chybí, když přepis vrátí null. */
  missing?: string
  /** Košík a pokladna: podstrčit ukázkový košík místo přepisu adresy. */
  cart?: true
}

const q = (token: string, extra = "") => `?token=${encodeURIComponent(token)}${extra}`

const orderPage =
  (pick: (d: StudioPreviewData) => StudioPreviewRef | null, suffix: string, withToken = false, extra = "") =>
  (d: StudioPreviewData, c: string) => {
    const ref = pick(d)
    if (!ref) return null
    const query = withToken ? q(ref.token, extra) : extra ? `?${extra.slice(1)}` : ""
    return `/${c}/order/${ref.id}/${suffix}${query}`
  }

const product =
  (kind: keyof StudioPreviewData["products"]) =>
  (d: StudioPreviewData, c: string) =>
    d.products[kind] ? `/${c}/products/${d.products[kind]}` : null

const account = (suffix: string) => (_orderId: string | null, c: string) => `/${c}/account${suffix}`

const LEGAL: Array<[string, string]> = [
  ["obchodni-podminky", "Obchodní podmínky"],
  ["reklamacni-rad", "Reklamační řád"],
  ["reklamacni-protokol", "Reklamační protokol"],
  ["odstoupeni-od-smlouvy", "Odstoupení od smlouvy"],
  ["ochrana-osobnich-udaju", "Ochrana osobních údajů"],
  ["cookies", "Používání cookies"],
  ["doprava-a-platba", "Doprava a platba"],
]

const NEWSLETTER: Array<[string, string]> = [
  ["potvrzeno", "přihlášení potvrzeno"],
  ["odhlaseno", "odhlášeno"],
  ["odhlaseno-upozorneni", "odhlášená upozornění"],
  ["jiz-odhlaseno", "už odhlášeno"],
  ["neplatny-odkaz", "neplatný odkaz"],
]

export const STUDIO_PREVIEW_PAGES: StudioPreviewPage[] = [
  /* Výrobky a výpisy */
  { path: "/cz/products/ukazka", title: "Ukázka · Výrobek", copy: null, target: product("regular"), missing: "běžný výrobek" },
  { path: "/cz/products/ukazka-zakazka", title: "Ukázka · Výrobek na zakázku", copy: null, target: product("madeToOrder"), missing: "výrobek na zakázku" },
  { path: "/cz/products/ukazka-po-domluve", title: "Ukázka · Výrobek s cenou po domluvě", copy: null, target: product("priceOnRequest"), missing: "výrobek s cenou po domluvě" },
  { path: "/cz/products/ukazka-poukaz", title: "Ukázka · Dárkový poukaz (výrobek)", copy: null, target: product("giftVoucher"), missing: "výrobek dárkový poukaz" },
  { path: "/cz/products/ukazka-vada", title: "Ukázka · Kus s vadou", copy: null, target: product("clearance"), missing: "kus s vadou" },
  { path: "/cz/products/ukazka-vyprodano", title: "Ukázka · Vyprodaný výrobek", copy: null, target: product("soldOut"), missing: "vyprodaný výrobek" },
  // Kategorie, kolekce i hledání jsou Obchod s filtrem (/categories/… a /results/… na něj přesměrují).
  { path: "/cz/store/ukazka-kategorie", title: "Ukázka · Obchod — kategorie", copy: "obchod", target: (d, c) => (d.categoryHandle ? `/${c}/store?category=${encodeURIComponent(d.categoryHandle)}` : null), missing: "kategorie" },
  { path: "/cz/store/ukazka-kolekce", title: "Ukázka · Obchod — kolekce", copy: "obchod", target: (d, c) => (d.collectionHandle ? `/${c}/store?collection=${encodeURIComponent(d.collectionHandle)}` : null), missing: "kolekce" },
  { path: "/cz/store/ukazka-hledani", title: "Ukázka · Obchod — hledání bez výsledků", copy: "obchod", fixed: "/cz/store?search=ukazka" },

  /* Košík a pokladna — Košík a Pokladnu má konfigurace jako stránky; tady jen podstrčení košíku. */
  { path: "/cz/cart", title: "Košík", copy: "kosik", cart: true },
  { path: "/cz/checkout", title: "Pokladna", copy: "pokladna", cart: true },
  { path: "/cz/cart/ukazka/confirmed", title: "Ukázka · Platba — dokončujeme objednávku", copy: "kosik" },
  { path: "/cz/cart/ukazka/pending", title: "Ukázka · Platba — čekáme na banku", copy: "kosik" },
  { path: "/cz/cart/ukazka/canceled", title: "Ukázka · Platba — nezaplaceno", copy: "kosik" },
  { path: "/cz/payment/ukazka/confirmed", title: "Ukázka · Návrat z brány — zaplaceno", copy: null },
  { path: "/cz/payment/ukazka/pending", title: "Ukázka · Návrat z brány — čeká se", copy: null },
  { path: "/cz/payment/ukazka/canceled", title: "Ukázka · Návrat z brány — zrušeno", copy: null },

  /* Po objednávce */
  { path: "/cz/order/ukazka/confirmed", title: "Ukázka · Objednávka — poděkování", copy: "kosik", target: orderPage((d) => d.order, "confirmed"), missing: "objednávka" },
  { path: "/cz/order/ukazka-platba-zaplaceno/confirmed", title: "Ukázka · Objednávka — platba prošla", copy: "kosik", target: orderPage((d) => d.order, "confirmed", false, "&platba=paid"), missing: "objednávka" },
  { path: "/cz/order/ukazka-platba-ceka/confirmed", title: "Ukázka · Objednávka — čekáme na banku", copy: "kosik", target: orderPage((d) => d.order, "confirmed", false, "&platba=ceka"), missing: "objednávka" },
  { path: "/cz/order/ukazka-platba-zrusena/confirmed", title: "Ukázka · Objednávka — platba zrušená", copy: "kosik", target: orderPage((d) => d.order, "confirmed", false, "&platba=zruseno"), missing: "objednávka" },
  { path: "/cz/order/ukazka-zakazka/confirmed", title: "Ukázka · Zakázka — poděkování", copy: "kosik", target: orderPage((d) => d.commissionOrder, "confirmed"), missing: "objednávka se zakázkou" },
  { path: "/cz/order/ukazka-po-domluve/confirmed", title: "Ukázka · Zakázka s cenou po domluvě", copy: "kosik", target: orderPage((d) => d.priceOnRequestOrder, "confirmed"), missing: "zakázka s cenou po domluvě" },
  { path: "/cz/order/ukazka-doplatek/confirmed", title: "Ukázka · Zakázka čeká na doplatek", copy: "kosik", target: orderPage((d) => d.awaitingBalanceOrder, "confirmed"), missing: "zakázka čekající na doplatek" },

  /* Samoobsluha objednávky (odkazy z e-mailu) */
  { path: "/cz/order/ukazka/edit", title: "Ukázka · Úprava objednávky", copy: null, target: orderPage((d) => d.order, "edit", true), missing: "objednávka" },
  { path: "/cz/order/ukazka/refund", title: "Ukázka · Zrušení objednávky", copy: null, target: orderPage((d) => d.order, "refund", true), missing: "objednávka" },
  { path: "/cz/order/ukazka/odstoupeni", title: "Ukázka · Odstoupení od smlouvy (formulář)", copy: null, target: orderPage((d) => d.order, "odstoupeni", true), missing: "objednávka" },
  { path: "/cz/order/ukazka/claims", title: "Ukázka · Reklamace", copy: null, target: orderPage((d) => d.order, "claims", true), missing: "objednávka" },
  { path: "/cz/order/ukazka/transfer/ukazka", title: "Ukázka · Převod objednávky — rozhodnutí", copy: null },
  { path: "/cz/order/ukazka/transfer/ukazka/accept", title: "Ukázka · Převod objednávky — neplatný odkaz", copy: null },

  /* Rychlý nákup */
  { path: "/cz/express-checkout/ukazka", title: "Ukázka · Rychlý nákup", copy: "kosik", target: (d, c) => (d.products.regular ? `/${c}/express-checkout/${d.products.regular}` : null), missing: "běžný výrobek" },
  { path: "/cz/express-checkout/confirmation/ukazka", title: "Ukázka · Rychlý nákup — hotovo", copy: "kosik", target: (d, c) => (d.order ? `/${c}/express-checkout/confirmation/${d.order.id}` : null), missing: "objednávka" },
  { path: "/cz/express-checkout/result/pending", title: "Ukázka · Rychlý nákup — čekáme na platbu", copy: "kosik" },
  { path: "/cz/express-checkout/result/canceled", title: "Ukázka · Rychlý nákup — zrušeno", copy: "kosik" },
  { path: "/cz/express-checkout/result/failed", title: "Ukázka · Rychlý nákup — platba neprošla", copy: "kosik" },

  /* Kurzy a poukazy */
  { path: "/cz/kurzy/rezervace/ukazka", title: "Ukázka · Rezervace kurzu", copy: "kurzy", target: (d, c) => (d.courseReservation ? `/${c}/kurzy/rezervace/${d.courseReservation.id}${q(d.courseReservation.token)}` : null), missing: "rezervace kurzu" },
  { path: "/cz/poukaz/ukazka", title: "Ukázka · Dárkový poukaz (zaplacený)", copy: null, target: (d, c) => (d.paidVoucher ? `/${c}/poukaz/${d.paidVoucher.id}${q(d.paidVoucher.token)}` : null), missing: "zaplacený dárkový poukaz" },
  { path: "/cz/poukaz/ukazka-nezaplaceny", title: "Ukázka · Dárkový poukaz (k zaplacení)", copy: null, target: (d, c) => (d.pendingVoucher ? `/${c}/poukaz/${d.pendingVoucher.id}${q(d.pendingVoucher.token)}` : null), missing: "nezaplacený dárkový poukaz" },

  /* Účet zákazníka — přihlášený ukázkový zákazník (z nejnovější objednávky s účtem) */
  { path: "/cz/account/ukazka", title: "Ukázka · Účet — přehled", copy: "ucet", account: account(""), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/orders", title: "Ukázka · Účet — objednávky", copy: "ucet", account: account("/orders"), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/order", title: "Ukázka · Účet — detail objednávky", copy: "ucet", account: (orderId, c) => (orderId ? `/${c}/account/orders/details/${orderId}` : null), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/kurzy", title: "Ukázka · Účet — kurzy", copy: "ucet", account: account("/kurzy"), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/addresses", title: "Ukázka · Účet — adresy", copy: "ucet", account: account("/addresses"), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/profile", title: "Ukázka · Účet — profil", copy: "ucet", account: account("/profile"), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/reviews", title: "Ukázka · Účet — recenze", copy: "ucet", account: account("/reviews"), missing: "zákazník s účtem" },
  { path: "/cz/account/ukazka/wishlist", title: "Ukázka · Účet — oblíbené", copy: "ucet", account: account("/wishlist"), missing: "zákazník s účtem" },
  { path: "/cz/reset-password", title: "Nastavení nového hesla", copy: "ucet" },
  { path: "/cz/verify-email", title: "Potvrzení e-mailu", copy: "ucet" },
  { path: "/cz/forgot-password", title: "Zapomenuté heslo", copy: null },

  /* Newsletter — stránky z odkazů v e-mailu */
  ...NEWSLETTER.map(([stav, label]): StudioPreviewPage => ({
    path: `/cz/newsletter/ukazka-${stav}`,
    title: `Ukázka · Newsletter — ${label}`,
    copy: "newsletter",
    fixed: `/cz/newsletter?stav=${stav}`,
  })),

  /* Právní dokumenty — tisková podoba aktuálního znění */
  ...LEGAL.map(([slug, label]): StudioPreviewPage => ({
    path: `/cz/pravni-dokument/${slug}/ukazka`,
    title: `Ukázka · Tisk — ${label}`,
    copy: null,
    legal: slug,
    missing: "platné znění dokumentu",
  })),
]

/** Stránky, které Studio dostane do seznamu (Košík a Pokladnu konfigurace už má). */
export const studioPreviewListed = STUDIO_PREVIEW_PAGES.filter((page) => !page.cart)

export const studioPreviewPageFor = (pathname: string): StudioPreviewPage | null =>
  STUDIO_PREVIEW_PAGES.find((page) => page.path === pathname.replace(/\/+$/, "")) ?? null

/** Potřebuje dotaz na `/api/studio/ukazka` (data, účet, znění, košík). */
export const studioPreviewNeedsResolve = (page: StudioPreviewPage): boolean =>
  Boolean(page.target || page.account || page.legal || page.cart)
