import { isDobirkaFeeLine } from "./dobirka"
import { isGiftVoucherLine } from "./gift-voucher-code"
import { isPackagingLine } from "./packaging"

/**
 * Dárkový poukaz v košíku — co z toho plyne pro pokladnu (30. 10. 2026).
 *
 * Poukaz není obyčejné zboží a pokladna se u něj chová jinak ve třech věcech:
 *
 * 1. **Doprava.** Košík, ve kterém není nic než poukazy, se neposílá
 *    dopravcem: elektronický chodí e-mailem (položka bez dopravy, krok
 *    Doručení se přeskočí celý — `needs-shipping.ts`), vytištěný se předává
 *    v dílně. Zařizuje restrikce `"voucher"` v `fragile.ts`.
 * 2. **Dobírka.** U poukazu nedává smysl nikdy, ani ve smíšeném košíku:
 *    peníze by dorazily až při předání zásilky, takže by poukaz do té doby
 *    nebyl platný — a elektronický by obdarovanému nepřišel vůbec. Zařizuje
 *    `lineAllowsDobirka` v `dobirka.ts`.
 * 3. **Platba.** Když celou částku pokryje jiný poukaz, neplatí se nic
 *    (`isZeroChargeCart` v `price-on-request.ts`).
 *
 * Proč zvláštní soubor: `dobirka.ts` potřebuje poznat poukaz a tenhle modul
 * potřebuje poznat servisní řádky z `dobirka.ts` — kdyby obojí žilo
 * v `gift-voucher-code.ts`, vznikl by kruhový import.
 */

type LineLike = {
  metadata?: Record<string, unknown> | null
  product?: { metadata?: Record<string, unknown> | null } | null
  variant_id?: string | null
  product_id?: string | null
  requires_shipping?: boolean | null
}

/** Řádky, o kterých se rozhoduje — bez balného a doběrečného (nejsou to výrobky). */
const goodsOf = (cart: { items?: Array<LineLike | null> | null } | null | undefined): LineLike[] =>
  ((cart?.items ?? []).filter(Boolean) as LineLike[]).filter(
    (item) => !isDobirkaFeeLine(item as never) && !isPackagingLine(item as never)
  )

/** Je v košíku aspoň jeden dárkový poukaz? */
export const cartHasGiftVoucher = (
  cart: { items?: Array<LineLike | null> | null } | null | undefined
): boolean => goodsOf(cart).some(isGiftVoucherLine)

/** Není v košíku nic než dárkové poukazy? (Prázdný košík ne — není o čem.) */
export const cartIsVoucherOnly = (
  cart: { items?: Array<LineLike | null> | null } | null | undefined
): boolean => {
  const goods = goodsOf(cart)
  return goods.length > 0 && goods.every(isGiftVoucherLine)
}
