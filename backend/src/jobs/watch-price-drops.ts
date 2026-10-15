import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import { PRICE_WATCH_MODULE } from "../modules/price-watch"
import type PriceWatchModuleService from "../modules/price-watch/service"
import { WISHLIST_MODULE } from "../modules/wishlist"
import type WishlistModuleService from "../modules/wishlist/service"
import { epsilonFor } from "../lib/ship-gate"
import { notifyMerchant } from "../lib/notify"
import {
  formatMoney,
  productLink,
  sendCustomerEmail,
} from "../lib/customer-email"
import {
  emailOptOutStore,
  isInOptOutSet,
  optedOutEmails,
} from "../lib/email-optout"
import { emailOptOutUrl } from "../lib/email-optout-link"
import {
  addDays,
  lowestPriceBefore,
  pragueDay,
  REFERENCE_WINDOW_DAYS,
  toAmount,
  type PriceHistoryPoint,
  type PriceKind,
} from "../lib/price-reference"
import { PRICE_HISTORY_MODULE } from "../modules/price-history"
import type PriceHistoryModuleService from "../modules/price-history/service"

/**
 * The morning price check for objects people keep in their oblíbených
 * (template „price-drop").
 *
 * ## Why 07:30 and not on every price edit
 *
 * Prices change while she is working with them: a sale set up across a shelf
 * of pieces, a typo corrected a minute later, a number tried and changed back.
 * Mailing on the edit would mail the typo. Once a day the price has settled
 * and is worth a quiet note — and 07:30 sits just after the 07:00 stock
 * family, so the morning's notifications arrive as one sitting rather than
 * trickling through the day.
 *
 * ## What counts as a drop
 *
 * Only variants somebody actually has in a wishlist are tracked — a snapshot
 * of an unwatched variant is noise nobody would ever read. The first sighting
 * of a variant records its price and never mails (there is no „before" to
 * compare against). A later price lower by more than the currency's rounding
 * epsilon is a drop; the snapshot then moves to the new price, so a drop is
 * DETECTED against the most recent price a customer could have seen.
 *
 * ## What the e-mail shows as the previous price (§ 12a ZOS)
 *
 * The e-mail announces a price reduction, so the struck-through „previous
 * price" must be the lowest price of the 30 days before the reduction — not
 * the last snapshot. It comes from the price history (`lib/price-reference`,
 * `lowestPriceBefore`). When the history doesn't cover the whole 30-day window
 * (the first month after it started) or the new price isn't below that
 * 30-day low, no e-mail goes out: a reduction that can't be backed by the
 * previous price must not be announced. (15. 10. 2026)
 *
 * Deduped per variant, amount and address
 * (`price-drop:{variant}:{amount}:{email}`), so a further drop to a new
 * amount mails again and a re-run at the same amount cannot.
 */

/**
 * The shop sells in one currency. Prices are read the way the
 * get-custom-price workflow reads them: `calculated_price` with a
 * currency-only QueryContext.
 */
const CURRENCY_CODE = "czk"

export default async function watchPriceDrops(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const wishlistModule =
    container.resolve<WishlistModuleService>(WISHLIST_MODULE)
  const priceWatch =
    container.resolve<PriceWatchModuleService>(PRICE_WATCH_MODULE)
  const customerModule = container.resolve(Modules.CUSTOMER)

  const items = (await wishlistModule.listWishlistItems(
    {},
    { relations: ["wishlist"] }
  )) as any[]

  if (!items.length) {
    return
  }

  // variant_id → the customers watching it. A customer with the same variant
  // in two wishlists (one per sales channel) still counts once.
  const watchersByVariant = new Map<string, Set<string>>()
  for (const item of items) {
    const customerId = item.wishlist?.customer_id
    if (!customerId || !item.product_variant_id) {
      continue
    }
    const watchers =
      watchersByVariant.get(item.product_variant_id) ?? new Set<string>()
    watchers.add(customerId)
    watchersByVariant.set(item.product_variant_id, watchers)
  }

  if (!watchersByVariant.size) {
    return
  }

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "title",
      "calculated_price.*",
      "product.id",
      "product.title",
      "product.handle",
      "product.thumbnail",
    ],
    filters: { id: [...watchersByVariant.keys()] },
    context: {
      calculated_price: QueryContext({ currency_code: CURRENCY_CODE }),
    },
  })

  const snapshots = (await priceWatch.listVariantPriceSnapshots({})) as any[]
  const snapshotByVariant = new Map(
    snapshots.map((snapshot) => [snapshot.variant_id, snapshot])
  )

  const epsilon = epsilonFor(CURRENCY_CODE)
  const now = new Date()
  const today = pragueDay(now)
  const priceHistory =
    container.resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)

  /** Nejnižší cena za 30 dní před dneškem z historie cen (§ 12a ZOS). */
  const thirtyDayLow = async (variantId: string, currencyCode: string) => {
    const rows = (await priceHistory.listPriceHistoryEntries({
      variant_id: variantId,
      currency_code: currencyCode,
      recorded_on: { $gte: addDays(today, -REFERENCE_WINDOW_DAYS) },
    } as never)) as any[]
    const points: PriceHistoryPoint[] = rows.flatMap((row) => {
      const amount = toAmount(row.amount)
      return amount == null
        ? []
        : [{ recorded_on: String(row.recorded_on), kind: row.kind as PriceKind, amount }]
    })
    return lowestPriceBefore(points, today)
  }

  // Variants whose price dropped and whose watchers were mailed.
  let droppedAndMailed = 0
  let sentEmails = 0
  let skippedOptOut = 0
  let skippedNoReference = 0

  for (const variant of variants as any[]) {
    try {
      const current = Number(variant.calculated_price?.calculated_amount)
      if (!Number.isFinite(current)) {
        // No price in this currency right now — nothing to compare, and
        // overwriting the snapshot with nothing would erase the comparison
        // point. Leave it be.
        continue
      }

      const currencyCode = String(
        variant.calculated_price?.currency_code ?? CURRENCY_CODE
      )
      const productTitle = variant.product?.title ?? null
      const snapshot = snapshotByVariant.get(variant.id)
      const previous = snapshot ? Number(snapshot.amount) : null

      const dropped =
        previous !== null &&
        Number.isFinite(previous) &&
        previous - current > epsilon

      // Předchozí cena v e-mailu = nejnižší za 30 dní před snížením (§ 12a ZOS).
      // Bez úplné historie, nebo když nová cena není pod 30denním minimem,
      // se snížení neoznamuje (snímek se níž stejně posune).
      const reference = dropped ? await thirtyDayLow(variant.id, currencyCode) : null
      const announceable =
        reference !== null &&
        reference.complete &&
        reference.lowest !== null &&
        reference.lowest - current > epsilon
      if (dropped && !announceable) {
        skippedNoReference += 1
      }

      if (dropped && announceable && reference?.lowest != null) {
        const customerIds = [...(watchersByVariant.get(variant.id) ?? [])]
        const customers = customerIds.length
          ? await customerModule.listCustomers({ id: customerIds })
          : []

        // Kdo upozornění odmítl odkazem z dřívějšího e-mailu (§ 7 odst. 3
        // zák. 480/2004 Sb.). Chyba dotazu sem nepustí nikoho — spadne do
        // catch níž a snímek se neposune, takže se pokles zítra zkusí znovu.
        const refused = await optedOutEmails(
          emailOptOutStore(container),
          customers.map((customer) => customer.email),
          "price_drop"
        )

        let mailedSomeone = false

        for (const customer of customers) {
          if (isInOptOutSet(refused, customer.email)) {
            skippedOptOut += 1
            continue
          }
          const name = [customer.first_name, customer.last_name]
            .filter(Boolean)
            .join(" ")
            .trim()

          const ok = await sendCustomerEmail(container, {
            template: "price-drop",
            to: customer.email,
            // A further drop to a new amount mails again; a re-run at the
            // same amount does not.
            key: `price-drop:${variant.id}:${current}:${customer.email}`,
            data: {
              // The template greets „Vážený zákazník" on its own when the
              // name is absent — better than sending an empty greeting.
              ...(name ? { customerName: name } : {}),
              // „Objekt z ateliéru" is the template's own subtitle voice, for
              // the (unlikely) product without a title.
              productName: productTitle ?? variant.title ?? "Objekt z ateliéru",
              ...(variant.product?.thumbnail
                ? { productImage: variant.product.thumbnail }
                : {}),
              // Nejnižší cena za 30 dní před snížením, ne poslední snímek
              // (§ 12a ZOS) — šablona ji tak i popíše.
              originalPrice: formatMoney(reference.lowest, currencyCode),
              newPrice: formatMoney(current, currencyCode),
              // Handle, not id — the storefront routes products by handle.
              productLink: productLink(variant.product?.handle ?? null),
              // The template defaults `timeLimited` to true with a mock date.
              // This drop has no known expiry, so say so explicitly rather
              // than let the mock promise one.
              timeLimited: false,
              // Odmítnutí dalších upozornění jedním kliknutím (OP čl. XIV).
              unsubscribe_url: emailOptOutUrl(customer.email, "price_drop"),
            },
          })

          if (ok) {
            sentEmails += 1
            mailedSomeone = true
          }
        }

        if (mailedSomeone) {
          droppedAndMailed += 1
        }
      }

      // Upsert after the sends: if sending threw, the old snapshot survives
      // and tomorrow's run re-detects the drop and retries under the same
      // dedupe key. Refreshing on an unchanged (or raised) price is
      // deliberate — the next drop is measured against the price as it stands.
      if (snapshot) {
        await priceWatch.updateVariantPriceSnapshots({
          id: snapshot.id,
          currency_code: currencyCode,
          amount: current,
          product_title: productTitle,
          captured_at: now,
        })
      } else {
        // First sighting only records — mailing here would announce a „drop"
        // from a price nobody was ever shown.
        await priceWatch.createVariantPriceSnapshots({
          variant_id: variant.id,
          currency_code: currencyCode,
          amount: current,
          product_title: productTitle,
          captured_at: now,
        })
      }
    } catch (error) {
      // One broken variant must not stop the rest of the sweep.
      logger.warn(
        `[price-drop] Variantu ${variant?.id} se nepodařilo zkontrolovat: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }

  try {
    // Snapshots for variants no longer in any wishlist are DELETED rather than
    // kept: the table mirrors „what is watched right now", and a variant
    // re-added later simply starts over with a fresh first sighting (recorded,
    // never mailed).
    const staleIds = snapshots
      .filter((snapshot) => !watchersByVariant.has(snapshot.variant_id))
      .map((snapshot) => snapshot.id)
    if (staleIds.length) {
      await priceWatch.deleteVariantPriceSnapshots(staleIds)
    }
  } catch (error) {
    logger.warn(
      `[price-drop] Úklid starých cenových snímků se nepodařil: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
  }

  if (droppedAndMailed > 0) {
    const today = now.toISOString().slice(0, 10)

    await notifyMerchant(container, {
      key: `price-drop-digest:${today}`,
      title: "Pokles cen v oblíbených",
      description:
        droppedAndMailed === 1
          ? "Cena klesla u jednoho objektu — zákazníci s ním v oblíbených dostali e-mail."
          : `Ceny klesly u ${droppedAndMailed} objektů — zákazníci s nimi v oblíbených dostali e-mail.`,
      audience: "owner",
    })

    logger.info(
      `[price-drop] Ceny klesly u ${droppedAndMailed} objektů, odesláno ${sentEmails} e-mailů.`
    )
  }
  if (skippedNoReference > 0) {
    logger.info(
      `[price-drop] ${skippedNoReference}× pokles neoznámen — historie cen nepokrývá 30 dní, nebo cena není pod 30denním minimem (§ 12a ZOS).`
    )
  }
  if (skippedOptOut > 0) {
    logger.info(
      `[price-drop] ${skippedOptOut}× přeskočeno — zákazník upozornění na pokles ceny odmítl.`
    )
  }
}

export const config = {
  name: "watch-price-drops",
  // 07:30 — after the 07:00 stock job family, so the morning's notifications
  // arrive as one sitting.
  schedule: "30 7 * * *",
}
