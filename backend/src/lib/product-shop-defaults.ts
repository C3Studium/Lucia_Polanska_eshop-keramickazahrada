/**
 * Výrobek musí být v obchodě vidět (18. 11. 2026).
 *
 * Naměřeno na produkci: „Modelovaný květináč Bonsaj s Vážkou" byl založený
 * a publikovaný, ale bez prodejního kanálu — store API vrací jen výrobky
 * v kanálu publikovatelného klíče, takže obchod ukazoval „Stránka
 * nenalezena". Ze 265 výrobků jediný bez kanálu; „Nový produkt" kanál
 * nenastavuje a přidat ho šlo jen ručně na detailu. Stejná past už jednou
 * zasáhla balíčky (api/admin/bundled-products).
 *
 * K tomu adresa: Medusa dělá handle z názvu i s diakritikou
 * („modelovaný-květináč-…-vážkou-20"). Obchod ji umí rozbalit, ale do
 * odkazů, sdílení a vyhledávačů patří ASCII jako u všech ostatních.
 */

/** „Modelovaný květináč Bonsaj s Vážkou - 20" → „modelovany-kvetinac-bonsaj-s-vazkou-20". */
export const asciiHandle = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

export const needsAsciiHandle = (handle: string | null | undefined): boolean =>
  Boolean(handle) && /[^a-z0-9-]/.test(String(handle))

/** První volná adresa: „x", „x-2", „x-3"… */
export const uniqueHandle = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) return base
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

/**
 * Má se výrobku doplnit kanál obchodu? Při založení vždy, když žádný nemá;
 * při úpravě jen publikovaný (publikovat = ukázat v obchodě). Skrytí
 * z obchodu je stav „koncept", ne odebrání kanálu, takže se nebijí.
 */
export const needsShopChannel = (
  product: { status?: string | null; sales_channels?: { id: string }[] | null },
  eventName: string
): boolean => {
  if ((product.sales_channels ?? []).length > 0) return false
  if (eventName === "product.created") return true
  return product.status === "published"
}
