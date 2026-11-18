import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { scheduleVyprodejSync } from "../lib/vyprodej"

/**
 * Výprodej sleduje katalog (`lib/vyprodej.ts`): nový výrobek v kategorii ve
 * výprodeji se zlevní, přesunutý vypadne, změna ceny se přepočte, prodaný
 * kus „do vyprodání zásob" z výprodeje vypadne. Srovná se jednou, chvíli po
 * poslední události z dávky.
 */
export default async function vyprodejSync({ container }: SubscriberArgs<unknown>) {
  scheduleVyprodejSync(container)
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product-variant.created",
    "product-variant.updated",
    "product-category.updated",
    "order.placed",
    "order.canceled",
  ],
  context: { subscriberId: "vyprodej-sync" },
}
