/**
 * Pomocníci stránky Zásoby (hledání, řazení, naskladnění po výpalu).
 * Čisté funkce bez Reactu, ať se dají ověřit testem.
 */

export type SkladRadek = {
  variant_id: string;
  variant_title: string | null;
  product_id: string | null;
  product_title: string | null;
  sku: string | null;
  inventory_item_id: string | null;
  stocked: number;
  reserved: number;
  available: number;
  threshold: number;
  has_custom_threshold: boolean;
  waiting_customers: number;
  wishlist_count: number;
};

/** Bez háčků a velkých písmen — „hrnek" najde „Hrnek", „modra" najde „modrá". */
export const bezDiakritiky = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Hledá v názvu produktu, provedení i SKU. Víc slov = všechna musí sedět
 * (v kterémkoli poli), takže „hrnek modr" najde modrý hrnek.
 */
export const odpovidaHledani = (radek: SkladRadek, hledat: string): boolean => {
  const slova = bezDiakritiky(hledat).split(/\s+/).filter(Boolean);
  if (!slova.length) return true;
  const text = bezDiakritiky(
    [radek.product_title, radek.variant_title, radek.sku].filter(Boolean).join(" ")
  );
  return slova.every((slovo) => text.includes(slovo));
};

export type Razeni = "zajem" | "abeceda";

const nazevRadku = (radek: SkladRadek) =>
  `${radek.product_title ?? ""} ${radek.variant_title ?? ""}`.trim();

/** „Podle zájmu" = dřívější Sklad+: čekající zákazníci, pak oblíbené, pak abeceda. */
export const seradit = <T extends SkladRadek>(radky: T[], razeni: Razeni): T[] =>
  [...radky].sort((a, b) => {
    if (razeni === "zajem") {
      const rozdil =
        b.waiting_customers - a.waiting_customers || b.wishlist_count - a.wishlist_count;
      if (rozdil) return rozdil;
    }
    return nazevRadku(a).localeCompare(nazevRadku(b), "cs");
  });

export type Pocet =
  | { druh: "prazdne" }
  | { druh: "ok"; kusy: number }
  | { druh: "chyba" };

/** Co napsala do „+ ks". Nula a prázdné pole = nic; desetinná nebo záporná čísla = chyba. */
export const precistPocet = (text: string): Pocet => {
  const ocisteny = text.trim();
  if (!ocisteny) return { druh: "prazdne" };
  if (!/^\d+$/.test(ocisteny)) return { druh: "chyba" };
  const kusy = Number(ocisteny);
  if (kusy === 0) return { druh: "prazdne" };
  if (kusy > 100_000) return { druh: "chyba" };
  return { druh: "ok", kusy };
};

/** „u 1 produktu", „u 6 produktů". */
export const uProduktu = (pocet: number): string =>
  pocet === 1 ? "u 1 produktu" : `u ${pocet} produktů`;

/** Kolik různých produktů — dvě provedení jednoho hrnku jsou jeden produkt. */
export const pocetProduktu = (radky: SkladRadek[]): number =>
  new Set(radky.map((radek) => radek.product_id ?? radek.variant_id)).size;

/** Nové id dávky pro ochranu proti dvojkliku. */
export const noveIdDavky = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `davka-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
