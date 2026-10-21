/**
 * „Cena po domluvě" — výrobek, který se neprodává z ceníku; cena vzniká až
 * po poptávce (Domovní znamení na zakázku, rozhodnutí Lucie 20.–21. 10. 2026).
 *
 * Zrcadlo backendu `lib/price-on-request.ts`: jediný zdroj pravdy je
 * `product.metadata.price_on_request === true` (přepínač „Cena po domluvě"
 * v administraci). Storefront podle něj píše „Cena po domluvě", schová
 * košík a vede na poptávku; backend stejný kus do košíku nepustí ani přes API.
 */
export const isPriceOnRequest = (
  metadata: Record<string, unknown> | null | undefined
): boolean => metadata?.price_on_request === true

/** Poptávka na stránce Výroba s předvyplněným výrobkem (`?produkt=<handle>`). */
export const inquiryHref = (handle?: string | null): string =>
  handle ? `/vyroba?produkt=${encodeURIComponent(handle)}#poptavka` : "/vyroba#poptavka"
