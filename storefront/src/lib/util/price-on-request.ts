import { isMadeToOrderLine } from "@lib/util/commission"

/**
 * „Cena po domluvě" — zakázka, jejíž cenu Lucie domluví až po objednávce
 * (Domovní znamení na zakázku; rozhodnutí 20.–24. 10. 2026).
 *
 * Zrcadlo backendu `lib/price-on-request.ts`: jediný zdroj pravdy je
 * `product.metadata.price_on_request === true` (přepínač „Bez ceny — cena po
 * domluvě" v administraci, zapne i zakázku). Kus jde normálně do košíku přes
 * `/line-items-custom` a backend mu dá cenu 0 Kč; obchod místo „0 Kč" píše
 * „Cena po domluvě" / „Po domluvě". Domluvenou cenu pošle Lucie e-mailem
 * a zákazník pak zaplatí zálohu nebo celé.
 */
export const isPriceOnRequest = (
  metadata: Record<string, unknown> | null | undefined
): boolean => metadata?.price_on_request === true

/** Poptávka na stránce Výroba s předvyplněným výrobkem (`?produkt=<handle>`). */
export const inquiryHref = (handle?: string | null): string =>
  handle ? `/vyroba?produkt=${encodeURIComponent(handle)}#poptavka` : "/vyroba#poptavka"

type LineLike = {
  unit_price?: number | string | null
  product?: {
    categories?: { handle?: string | null }[] | null
    metadata?: Record<string, any> | null
  } | null
  metadata?: Record<string, any> | null
}

/**
 * Řádek košíku/objednávky objednaný za 0 Kč s cenou po domluvě. Pozná se
 * podle vlajky produktu; když produkt v datech není (nebo mu vlajku mezitím
 * vypnuli), podle stejného znaku jako backend (`isAgreedPriceCommission`):
 * zakázka s cenou řádku 0.
 */
export const isPriceOnRequestLine = (item: LineLike | null | undefined): boolean => {
  if (!item) return false
  if (Number(item.unit_price ?? 0) > 0.005) return false
  return isPriceOnRequest(item.product?.metadata) || isMadeToOrderLine(item)
}

/** Má košík/objednávka aspoň jeden řádek s cenou po domluvě? */
export const hasPriceOnRequestLine = (
  items: LineLike[] | null | undefined
): boolean => (items ?? []).some(isPriceOnRequestLine)

/** Text místo částky u řádku s cenou po domluvě. */
export const PRICE_ON_REQUEST_LINE_LABEL = "Po domluvě"

/** Věta pod cenou na stránce výrobku. */
export const PRICE_ON_REQUEST_PRODUCT_NOTE =
  "Objednáte teď za 0 Kč; cenu vám po domluvě pošlu e-mailem a pak zaplatíte zálohu nebo celou částku."

/** Věta v souhrnu košíku/pokladny, když je v něm kus s cenou po domluvě. */
export const PRICE_ON_REQUEST_SUMMARY_NOTE =
  "Cenu výrobků po domluvě vám pošlu e-mailem — teď platíte jen ostatní zboží a dopravu."

/** Věta u tlačítka, když se při objednání neplatí nic. */
export const PRICE_ON_REQUEST_ZERO_NOTE =
  "Teď se nic neplatí. Až spolu domluvíme cenu, pošlu vám ji e-mailem a zaplatíte zálohu nebo celou částku."

/** Tlačítko odeslání objednávky za 0 Kč. */
export const PRICE_ON_REQUEST_ZERO_BUTTON = "Odeslat objednávku"

/** Poskytovatel platby pro objednávku, ve které se teď nic neplatí. */
export const ZERO_PAYMENT_PROVIDER = "pp_system_default"

/**
 * Objednávka s cenou po domluvě, ve které je teď k úhradě 0 (jen takový kus
 * a osobní odběr). ComGate 0 Kč nevezme → relace `pp_system_default`.
 */
export const isZeroPriceOnRequestCart = (
  cart: { total?: number | null; items?: LineLike[] | null } | null | undefined
): boolean =>
  Boolean(cart) &&
  Number(cart?.total ?? 0) <= 0.005 &&
  hasPriceOnRequestLine(cart?.items)

/** Název platby u objednávky, ve které se při objednání nic neplatilo. */
export const ZERO_PAYMENT_TITLE = "Bez platby při objednání"

/** Stav platby, dokud cena po domluvě není zaplacená. */
export const ZERO_PAYMENT_STATUS = "Cenu pošlu e-mailem"

/**
 * Platba objednávky za 0 Kč (`pp_system_default`, částka 0) — název místo
 * „Testovací platba", který patří jen sandboxu.
 */
export const isZeroPayment = (
  payment: { provider_id?: string | null; amount?: number | string | null } | null | undefined
): boolean =>
  Boolean(payment?.provider_id?.startsWith(ZERO_PAYMENT_PROVIDER)) &&
  Number(payment?.amount ?? 0) <= 0.005

/** Věta u souhrnu hotové objednávky, dokud cena po domluvě není zaplacená. */
export const PRICE_ON_REQUEST_ORDER_NOTE =
  "Cenu výrobku po domluvě vám pošlu e-mailem. Zálohu nebo celou částku pak zaplatíte přímo z odkazu v něm."
