import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { refreshStorefront } from "../lib/storefront-refresh"

/**
 * Menu E-shop hned po změně kolekce nebo kategorie (16. 11. 2026, Matěj).
 *
 * Storefront drží kolekce a kategorie v mezipaměti (`force-cache`) se
 * značkami na návštěvníka, takže změna v adminu — přetažené pořadí
 * (`metadata.nav_order`), nový název, očko „skrytá" — se do menu dostala až
 * s další revalidací. Tady se po každé změně storefront obnoví celý.
 *
 * Přetažení zapíše víc kategorií za sebou (každá svůj index), proto se
 * obnova o chvilku odloží a sloučí do jedné.
 */
let timer: ReturnType<typeof setTimeout> | null = null

export default async function catalogMenuRefresh({ container }: SubscriberArgs<{ id: string }>) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void refreshStorefront(container, { everything: true })
  }, 1500)
}

export const config: SubscriberConfig = {
  event: [
    "product-collection.created",
    "product-collection.updated",
    "product-collection.deleted",
    "product-category.created",
    "product-category.updated",
    "product-category.deleted",
  ],
}
