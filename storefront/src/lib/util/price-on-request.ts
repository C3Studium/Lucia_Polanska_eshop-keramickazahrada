import { isMadeToOrderLine } from "@lib/util/commission"
import { TEXTY_DEFAULTS } from "@lib/constants/texty"

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
  TEXTY_DEFAULTS["produkt.cena_po_domluve"]

/**
 * Věta v souhrnu košíku/pokladny, když je v něm kus s cenou po domluvě.
 *
 * O poštovném tu nic nestojí schválně: kdy se platí, závisí na zbytku košíku
 * (backendové `lib/deposit-split.ts`, `shippingTiming`) — sám se zakázkou až
 * v doplatku, s běžným zbožím hned. Dřív tu bylo „teď platíte jen ostatní
 * zboží a dopravu", což v košíku jen se zakázkou neplatilo. Kolik se opravdu
 * platí, říká krok Platba z částky spočítané serverem.
 */
export const PRICE_ON_REQUEST_SUMMARY_NOTE =
  TEXTY_DEFAULTS["kosik.cena_po_domluve"]

/** Věta u tlačítka, když se při objednání neplatí nic. */
export const PRICE_ON_REQUEST_ZERO_NOTE =
  TEXTY_DEFAULTS["pokladna.cena_po_domluve_nula"]

/**
 * Tlačítko odeslání objednávky za 0 Kč.
 *
 * U ceny po domluvě se teď neplatí nic, takže „Zaplatit" by lhalo a „Odeslat
 * objednávku" zase zlehčovalo, co se děje: zákazník se objednávkou závazně
 * zavazuje a platí až potom (30. 10. 2026). Košík zaplacený celý poukazem je
 * obyčejné odeslání — tam zbývá původní znění.
 */
export const PRICE_ON_REQUEST_ZERO_BUTTON = "Závazně objednat — platba po domluvě"
export const VOUCHER_ZERO_BUTTON = "Odeslat objednávku"

/** Poskytovatel platby pro objednávku, ve které se teď nic neplatí. */
export const ZERO_PAYMENT_PROVIDER = "pp_system_default"

/**
 * Košík, ve kterém je k úhradě 0 — cena po domluvě, nebo celou částku pokryl
 * dárkový poukaz. ComGate 0 Kč nevezme a kartu tu chtít nemá smysl: relace
 * `pp_system_default` (backend ji pustí jen na kolekci za 0 Kč, viz
 * `backend/src/lib/zero-payment-guard.ts`) a objednávka se rovnou odešle.
 *
 * Součet košíku na to NESTAČÍ. U zakázky stojí poštovné mimo zálohu a
 * v košíku, kde není nic než zakázka, se odkládá do doplatku (backendové
 * `lib/deposit-split.ts`, `shippingTiming`). Košík s cenou po domluvě a
 * Českou poštou má tedy `total` třeba 150 Kč, ale k úhradě 0 — a tenhle
 * rozdíl vznikl 6. 11. 2026, kdy si i takový kus smí vybrat dopravu.
 * Kdo zná částku spočítanou serverem (`chargeSplit` nad režimem platby
 * zakázky), ať ji předá: jinak by pokladna poslala ComGate platbu za nulu,
 * kterou brána odmítne, a zákazník by uvízl na kroku Platba.
 */
export const isZeroChargeCart = (
  cart: { total?: number | null; items?: LineLike[] | null } | null | undefined,
  chargeNow?: number | null
): boolean =>
  Boolean(cart) &&
  (cart?.items?.length ?? 0) > 0 &&
  Number(chargeNow ?? cart?.total ?? 0) <= 0.005

/** Věta u tlačítka, když celou objednávku pokryl dárkový poukaz. */
export const VOUCHER_ZERO_NOTE = TEXTY_DEFAULTS["kosik.poukaz_vse"]

/** Název platby u objednávky zaplacené celou dárkovým poukazem. */
export const VOUCHER_PAYMENT_TITLE = "Uhrazeno dárkovým poukazem"

/** Texty kroku Platba / Přehled pro objednávku za 0 — podle toho, proč je 0. */
export const zeroChargeCopy = (
  cart: { items?: LineLike[] | null } | null | undefined
) =>
  hasPriceOnRequestLine(cart?.items)
    ? {
        heading: "Teď nic neplatíte",
        note: PRICE_ON_REQUEST_ZERO_NOTE,
        title: "Bez platby při objednání",
        reviewLabel: "Teď se nic neplatí",
        reviewNote:
          "cenu výrobku po domluvě vám pošlu e-mailem, pak zaplatíte zálohu nebo celou částku online",
        button: PRICE_ON_REQUEST_ZERO_BUTTON,
      }
    : {
        heading: "Zaplaceno dárkovým poukazem",
        note: VOUCHER_ZERO_NOTE,
        title: VOUCHER_PAYMENT_TITLE,
        reviewLabel: VOUCHER_PAYMENT_TITLE,
        reviewNote: "k úhradě nezbývá nic",
        button: VOUCHER_ZERO_BUTTON,
      }

/** Název platby u objednávky, ve které se při objednání nic neplatilo. */
export const ZERO_PAYMENT_TITLE = "Bez platby při objednání"

/** Název platby objednávky za 0: cena po domluvě, jinak celou pokryl poukaz. */
export const zeroPaymentTitle = (
  order: { items?: LineLike[] | null } | null | undefined
): string =>
  hasPriceOnRequestLine(order?.items) ? ZERO_PAYMENT_TITLE : VOUCHER_PAYMENT_TITLE

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
