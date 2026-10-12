/**
 * Balné — vlastní položka u KAŽDÉHO produktu (12. 10. 2026, Matěj + Lucie).
 *
 * ## Co platí
 *
 * - Každý produkt má cenu balení v Kč (`product.metadata.packaging_price`,
 *   admin „Cena balení"); nevyplněná = 0 Kč = žádná položka balného.
 * - Balné se účtuje VŽDY — i u osobního odběru (rozhodnutí 12. 10.).
 * - Je to samostatná položka hned pod produktem: „Balné — <název>", stejný
 *   počet kusů jako produkt. Tím ho ukáže košík, objednávka, e-mail, admin
 *   i faktura bez dalších výpočtů — stejně jako doběrečné (`dobirka-fee.ts`).
 * - Cizí měna: přepočet kurzem ČNB a zaokrouhlení NAHORU na 0,50
 *   (12,16 → 12,50; 12,46 → 12,50; 12,51 → 13,00). Koruna beze změny.
 *
 * ## Proč ne v ceně dopravy
 *
 * Původní návrh (srpen) balné přičítal k poštovnému přes „počítanou" cenu
 * dopravy. Volby dopravy ale zůstaly s pevnou cenou, takže se balné nikdy
 * nenaúčtovalo — a faktura ho přitom z poštovného „vybalovala" (lež). Balné
 * k produktu navíc patří i u osobního odběru, kde žádná doprava není.
 *
 * ## Identita položky
 *
 * Značka `packaging_fee` v metadatech A žádný variant ani produkt za řádkem
 * — stejně jako u doběrečného. Metadata umí poslat každý klient, ale každá
 * zákaznická routa vyžaduje `variant_id`; řádek bez varianty zakládá jen
 * server. Ke kterému produktu balné patří, říká `packaging_variant_id`
 * (varianta přežije převod košíku na objednávku, id řádku ne).
 *
 * ## Kdy se košík srovná
 *
 * `syncPackagingForCart` je idempotentní (správný košík = žádná změna) a
 * běží při načtení košíku (storefront po každé změně košík znovu čte, takže
 * zákazník balné vidí hned) a před výběrem platby (částka platby už balné
 * obsahuje). Kontrola při dokončení záměrně NENÍ: po zaplacení kartou by
 * mohla zablokovat zaplacenou objednávku. Není ani potřeba — každá změna
 * položek košíku zneplatní platební relaci (Medusa přepočítá kolekci), takže
 * nová platba jde zase přes výběr platby a tedy přes srovnání balného.
 */

import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { decimalDigitsFor, fetchCnbRates, type CnbRateSheet } from "./cnb-rates"
import { toNumber } from "./order-quantity"

import {
  isPackagingLine,
  PACKAGING_MARKER,
  PACKAGING_PRODUCT_KEY,
  PACKAGING_VARIANT_KEY,
  packagingTitleFor,
} from "./packaging-lines"

export {
  isPackagingLine,
  PACKAGING_MARKER,
  PACKAGING_PRODUCT_KEY,
  PACKAGING_TITLE,
  PACKAGING_VARIANT_KEY,
  packagingTitleFor,
  packagingVariantOf,
  withPackagingUnderProducts,
} from "./packaging-lines"

export type PackagingLineLike = {
  id?: string
  title?: string | null
  product_title?: string | null
  quantity?: unknown
  unit_price?: unknown
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
  product?: { title?: string | null; metadata?: Record<string, unknown> | null } | null
}

/** Cena balení produktu v Kč; nevyplněná / nesmysl = 0. */
export const packagingPriceCzkOf = (metadata: Record<string, unknown> | null | undefined): number => {
  const raw = metadata?.packaging_price
  if (raw === null || raw === undefined || raw === "") return 0
  const parsed = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

/**
 * Nahoru na nejbližší 0,50 (12,16 → 12,50; 12,51 → 13). Drobná tolerance,
 * ať 12,50 zůstane 12,50 i po plovoucí čárce (12,5000000001).
 */
export const roundUpToHalf = (value: number): number => {
  if (!(value > 0)) return 0
  const cents = Math.round(value * 100)
  return Math.ceil(cents / 50) / 2
}

/**
 * Cena balení za kus v měně košíku. Koruna = jak je zadaná; cizí měna =
 * kurz ČNB a nahoru na 0,50 (měna bez desetin — HUF, JPY — nahoru na celé).
 * `null` = cizí měnu nejde ocenit (chybí kurz) — volající pak nic nemění.
 */
export const packagingUnitPrice = (
  czk: number,
  currencyCode: string | null | undefined,
  sheet: CnbRateSheet | null
): number | null => {
  if (!(czk > 0)) return 0
  const currency = String(currencyCode ?? "czk").toUpperCase()
  if (currency === "CZK") return Math.round(czk * 100) / 100
  const rate = sheet?.rates.get(currency)
  if (!rate) return null
  const converted = czk / (rate.rate / rate.amount)
  return decimalDigitsFor(currency) === 0 ? Math.ceil(converted - 1e-9) : roundUpToHalf(converted)
}

export type PackagingPlan = {
  add: Array<{
    variant_id: string
    product_id: string | null
    title: string
    quantity: number
    unit_price: number
  }>
  /** `quantity_changed` = nesedí počet kusů (strukturální vada, ne jen cena/název). */
  update: Array<{ id: string; quantity: number; unit_price: number; title: string; quantity_changed: boolean }>
  remove_ids: string[]
}

/**
 * Čistý plánovač: z řádků košíku (produkty i už existující balné) a ceny
 * balení za kus (v měně košíku) určí, co přidat, upravit a smazat, aby u
 * každé varianty s nenulovým balným byla PRÁVĚ JEDNA položka balného se
 * stejným počtem kusů. Idempotentní — správný košík dá prázdný plán.
 *
 * `unitPriceFor` vrací `null`, když cenu nejde určit (chybí kurz): existující
 * položka se pak nechá být a nová se nepřidá — radši nic než špatné číslo.
 */
export const planPackaging = (input: {
  items: PackagingLineLike[]
  unitPriceFor: (item: PackagingLineLike) => number | null
}): PackagingPlan => {
  const items = input.items ?? []
  const products = new Map<
    string,
    { variant_id: string; product_id: string | null; title: string; quantity: number; unit: number | null }
  >()
  for (const item of items) {
    if (!item?.variant_id || isPackagingLine(item)) continue
    // Doběrečné a jiné servisní řádky nemají variantu — sem nedojdou.
    const key = String(item.variant_id)
    const existing = products.get(key)
    const quantity = Math.max(0, Math.round(toNumber(item.quantity)))
    if (existing) {
      existing.quantity += quantity
      continue
    }
    products.set(key, {
      variant_id: key,
      product_id: item.product_id ?? null,
      title: packagingTitleFor(item.product_title ?? item.product?.title ?? item.title),
      quantity,
      unit: input.unitPriceFor(item),
    })
  }

  const plan: PackagingPlan = { add: [], update: [], remove_ids: [] }
  const seen = new Set<string>()
  for (const line of items.filter(isPackagingLine)) {
    const key = String(line.metadata?.[PACKAGING_VARIANT_KEY] ?? "")
    const product = products.get(key)
    if (!product || seen.has(key) || product.quantity <= 0 || product.unit === 0) {
      // Bez produktu, duplicitní, nebo produkt balné nemá (už) žádné.
      plan.remove_ids.push(String(line.id))
      continue
    }
    seen.add(key)
    if (product.unit === null) continue // cenu teď nejde určit — nechat být
    const quantityOk = Math.round(toNumber(line.quantity)) === product.quantity
    const priceOk = Math.abs(toNumber(line.unit_price) - product.unit) < 0.005
    const titleOk = (line.title ?? "") === product.title
    if (!quantityOk || !priceOk || !titleOk) {
      plan.update.push({
        id: String(line.id),
        quantity: product.quantity,
        unit_price: product.unit,
        title: product.title,
        quantity_changed: !quantityOk,
      })
    }
  }
  for (const product of products.values()) {
    if (seen.has(product.variant_id) || product.quantity <= 0) continue
    if (product.unit === null || product.unit <= 0) continue
    plan.add.push({
      variant_id: product.variant_id,
      product_id: product.product_id,
      title: product.title,
      quantity: product.quantity,
      unit_price: product.unit,
    })
  }
  return plan
}

export const isEmptyPlan = (plan: PackagingPlan): boolean =>
  !plan.add.length && !plan.update.length && !plan.remove_ids.length

// --- kurzy ČNB (jen pro cizí měny) -------------------------------------------

const RATES_TTL_MS = 6 * 60 * 60 * 1000
let cachedSheet: { sheet: CnbRateSheet; at: number } | null = null

/** Kurzovní lístek s cache na 6 h; při výpadku ČNB poslední dobrý. */
export const cnbSheetCached = async (): Promise<CnbRateSheet | null> => {
  if (cachedSheet && Date.now() - cachedSheet.at < RATES_TTL_MS) {
    return cachedSheet.sheet
  }
  try {
    const sheet = await fetchCnbRates()
    cachedSheet = { sheet, at: Date.now() }
    return sheet
  } catch {
    return cachedSheet?.sheet ?? null
  }
}

// --- košík ----------------------------------------------------------------------

const CART_FIELDS = [
  "id",
  "currency_code",
  "completed_at",
  "items.id",
  "items.title",
  "items.product_title",
  "items.quantity",
  "items.unit_price",
  "items.metadata",
  "items.variant_id",
  "items.product_id",
  "items.product.title",
  "items.product.metadata",
]

const cartLocks = new Map<string, Promise<unknown>>()

/** Jeden běh na košík naráz — souběžná čtení košíku nesmí balné zdvojit. */
const withCartLock = async <T>(cartId: string, fn: () => Promise<T>): Promise<T> => {
  const previous = cartLocks.get(cartId) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(fn)
  cartLocks.set(cartId, run)
  try {
    return await run
  } finally {
    if (cartLocks.get(cartId) === run) cartLocks.delete(cartId)
  }
}

/** Plán pro košík (bez zápisu) — sdílí ho synchronizace i kontrola dokončení. */
export const planPackagingForCart = async (
  container: MedusaContainer,
  cartId: string
): Promise<{ cart: any; plan: PackagingPlan } | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: CART_FIELDS,
    filters: { id: cartId },
  })
  const cart = (data as any[])[0]
  if (!cart || cart.completed_at) return null
  const currency = String(cart.currency_code ?? "czk").toLowerCase()
  const sheet = currency === "czk" ? null : await cnbSheetCached()
  const plan = planPackaging({
    items: (cart.items ?? []) as PackagingLineLike[],
    unitPriceFor: (item) =>
      packagingUnitPrice(packagingPriceCzkOf(item.product?.metadata), currency, sheet),
  })
  return { cart, plan }
}

/**
 * Srovná položky balného v košíku. Když se něco změnilo a košík už má
 * platební kolekci, přepočítá její částku (a zahodí staré relace) — stejně
 * jako doběrečné, ať platba nikdy nejde na starou částku.
 */
export const syncPackagingForCart = async (
  container: MedusaContainer,
  cartId: string
): Promise<{ changed: boolean }> =>
  withCartLock(cartId, async () => {
    const planned = await planPackagingForCart(container, cartId)
    if (!planned || isEmptyPlan(planned.plan)) return { changed: false }
    const { plan } = planned

    const cartModule = container.resolve<ICartModuleService>(Modules.CART)
    if (plan.remove_ids.length) {
      await cartModule.deleteLineItems(plan.remove_ids)
    }
    for (const entry of plan.update) {
      await cartModule.updateLineItems(entry.id, {
        quantity: entry.quantity,
        unit_price: entry.unit_price,
        title: entry.title,
      })
    }
    if (plan.add.length) {
      await cartModule.addLineItems(
        plan.add.map((entry) => ({
          cart_id: cartId,
          title: entry.title,
          quantity: entry.quantity,
          unit_price: entry.unit_price,
          // Bez varianty — přepočty košíku ji nesmí zkoušet přecenit.
          is_custom_price: true,
          // Slevové kódy se balného netýkají.
          is_discountable: false,
          // Nic se nebalí zvlášť — mimo seznamy k vyskladnění.
          requires_shipping: false,
          metadata: {
            [PACKAGING_MARKER]: true,
            [PACKAGING_VARIANT_KEY]: entry.variant_id,
            ...(entry.product_id ? { [PACKAGING_PRODUCT_KEY]: entry.product_id } : {}),
          },
        }))
      )
    }

    await refreshPaymentCollectionForCartWorkflow(container)
      .run({ input: { cart_id: cartId } })
      .catch(() => undefined)
    return { changed: true }
  })

/**
 * Middleware pro `GET /store/carts/:id`: košík se srovná dřív, než ho route
 * vrátí — storefront po každé změně (přidání, množství, odebrání, měna) košík
 * znovu čte, takže zákazník balné vidí hned. Chyba čtení košík neshodí.
 */
export const syncPackagingOnCartRead = () => {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      if (req.params.id) {
        await syncPackagingForCart(req.scope, req.params.id)
      }
    } catch (error) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[balné] Srovnání košíku ${req.params.id} selhalo: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
    }
    next()
  }
}

/**
 * Middleware pro výběr platby (`POST /store/payment-collections/:id/payment-sessions`)
 * — jediné hrdlo, kterým jde každá pokladna. Balné se srovná PŘED vznikem
 * relace, takže platba je vždy na částku i s balným. Selhání = chyba (radši
 * než platba na špatnou částku).
 */
export const syncPackagingOnPaymentSession = () => {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "cart_payment_collection",
        fields: ["cart_id"],
        filters: { payment_collection_id: req.params.id },
      })
      const cartId = (data[0] as any)?.cart_id
      if (cartId) {
        await syncPackagingForCart(req.scope, cartId)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
