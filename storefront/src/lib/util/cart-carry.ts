import { isServiceLine } from "./packaging"

type CarryLine = {
  variant_id?: string | null
  product_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Řádky košíku, které se při převodu na novou verzi obchodu přenášejí
 * (`lib/data/cart-version.ts`).
 *
 * Jen zboží: balné a doběrečné nemají variantu a zakládá je server sám
 * (balné při každém čtení košíku, doběrečné při volbě platby). Poslat je
 * zákaznickou cestou `/line-items-custom` skončí 400 — tak se to dělo po
 * každém nasazení u košíku, který už byl v pokladně (provozní hlídka
 * 20. 11. 2026: `variant_id: null` s `packaging_fee`).
 */
export const carriableLines = <T extends CarryLine>(items: T[] | null | undefined): T[] =>
  (items ?? []).filter((item) => !isServiceLine(item) && Boolean(item.variant_id))
