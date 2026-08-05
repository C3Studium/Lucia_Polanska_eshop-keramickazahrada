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
 * always measured against the most recent price a customer could have seen,
 * not a historic low.
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

  // Variants whose price dropped and whose watchers were mailed.
  let droppedAndMailed = 0
  let sentEmails = 0

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

      if (dropped) {
        const customerIds = [...(watchersByVariant.get(variant.id) ?? [])]
        const customers = customerIds.length
          ? await customerModule.listCustomers({ id: customerIds })
          : []

        let mailedSomeone = false

        for (const customer of customers) {
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
              originalPrice: formatMoney(
                previous,
                snapshot?.currency_code ?? currencyCode
              ),
              newPrice: formatMoney(current, currencyCode),
              // Handle, not id — the storefront routes products by handle.
              productLink: productLink(variant.product?.handle ?? null),
              // The template defaults `timeLimited` to true with a mock date.
              // This drop has no known expiry, so say so explicitly rather
              // than let the mock promise one.
              timeLimited: false,
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
}

export const config = {
  name: "watch-price-drops",
  // 07:30 — after the 07:00 stock job family, so the morning's notifications
  // arrive as one sitting.
  schedule: "30 7 * * *",
}
