import { LEGACY_CATEGORIES, LEGACY_PRODUCTS } from "./legacy-wordpress-map"

/**
 * Adresy starého webu (WordPress + WooCommerce) na doméně keramickazahrada.cz.
 *
 * 21. 11. 2026: Seznam i Google mají ze starého webu zaindexované výrobky
 * i s obrázky — v hledání obrázků ukážou kus s cenou a „Skladem", jenže
 * „Přejít na web" vedl na /shop/<název>/ a nový obchod odpověděl „Stránka
 * nenalezena". Trvalé přesměrování (301) pošle zákazníka na stejný kus
 * a vyhledávači řekne, že stránka se přestěhovala — pořadí i obrázky si
 * převede na novou adresu.
 *
 * Obrázky (/wp-content/uploads) a přihlášení do WordPressu jdou DOČASNĚ (307)
 * na starý web, který dál běží na dev.keramickazahrada.cz: obrázek z hledání
 * se zobrazí, dokud vyhledávač nenačte nové stránky výrobků.
 */

export type LegacyRedirect = { location: string; status: 301 | 307 }

/** Stránky a články starého webu (bez lomítek) → cesta v novém obchodě. */
const LEGACY_PAGES: Record<string, string> = {
  keramika_obchod: "/store",
  shop: "/store",
  obchod: "/store",
  "stitek-produktu": "/store",
  "my-account": "/account",
  keramicke_kurzy: "/kurzy",
  "obchodni-podminky": "/smluvni-podminky",
  "lucie-polanska-keramika-kontakt": "/o-mne",
  "prisla-vam-ponicena-zasilka": "/reklamacni-rad",
  // Články o kurzech
  "keramicky-kurzik-pro-nejmensi": "/kurzy",
  "velikonocni-ovecky-s-detmi-v-kms-pisek": "/kurzy",
  "keramicke-tvoreni-ve-skolce-putimi": "/kurzy",
  // Ostatní články (rozhovory, novinky z dílny) → o mně
  blog_keramicka_dilna_polanska: "/o-mne",
  "vitam-vas": "/o-mne",
  "hvezdny-zvonek-v-top-vyberu-na-fler-cz": "/o-mne",
  "dd-zvikovske-podhradi-keramika-prvni-vypal": "/o-mne",
  "nova-varka-zardin-s-jesterkou": "/o-mne",
  "1997": "/o-mne",
  "pisecky-denik-pisecky-denik-cz": "/o-mne",
  "fler-rozhovor-nikilu-proste-jen-kus-hliny": "/o-mne",
  "rozhovor-casopis-rozmaryna-stare-remeslo-jeste-zije": "/o-mne",
  "ukonceni-prodeje-nikilu-na-portalu-fler": "/o-mne",
  "stehovani-stroju-po-cele-zemi": "/o-mne",
}

const WORDPRESS_FILES = /^\/(wp-content|wp-admin|wp-includes)(\/|$)|^\/wp-login\.php$/

/**
 * Přesměrování pro starou adresu, nebo `null`, když adresa patří novému obchodu.
 *
 * @param pathname cesta z požadavku (bez dotazu)
 * @param region   kód země, pod kterým obchod běží („cz")
 * @param wpOrigin kde dál běží starý WordPress; prázdné = obrázky nepřesměrovávat
 */
export function legacyRedirect(
  pathname: string,
  region: string,
  wpOrigin: string
): LegacyRedirect | null {
  if (WORDPRESS_FILES.test(pathname)) {
    return wpOrigin ? { location: `${wpOrigin.replace(/\/$/, "")}${pathname}`, status: 307 } : null
  }

  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {
    // osamělé „%" — porovná se, jak přišlo
  }
  const segments = path.toLowerCase().split("/").filter(Boolean)
  const [first, ...rest] = segments
  if (!first) return null

  const target = (to: string): LegacyRedirect => ({
    location: encodeURI(`/${region}${to}`),
    status: 301,
  })

  if ((first === "shop" || first === "produkt") && rest.length) {
    return target(LEGACY_PRODUCTS[rest[rest.length - 1]] ?? "/store")
  }
  if (first === "kategorie-produktu") {
    return target((rest.length && LEGACY_CATEGORIES[rest[rest.length - 1]]) || "/store")
  }
  if (first === "category") {
    return target(rest[0] === "kurzy" ? "/kurzy" : "")
  }
  if (first.startsWith("dovolena")) {
    return target("")
  }
  if (Object.hasOwn(LEGACY_PAGES, first) && (rest.length === 0 || first === "my-account" || first === "stitek-produktu")) {
    return target(LEGACY_PAGES[first])
  }
  return null
}
