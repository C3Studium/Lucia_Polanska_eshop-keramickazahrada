import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { isClearanceProduct } from "./clearance"

/**
 * Poškozený kus — rezervace v košíku na 30 minut (18. 11. 2026, přání
 * majitele: „z e-shopu ať je kus 30 minut rezervovaný pro košík").
 *
 * Poškozený kus je jediný. Bez rezervace si ho do košíku dá kdokoli a koupí
 * ho ten, kdo dřív zaplatí — druhý se to dozví až u platby.
 *
 * ## Proč ne nativní rezervace Medusy
 *
 * Háček `addToCartWorkflow.hooks.validate` běží PŘED kontrolou skladu
 * (`confirmVariantInventoryWorkflow`). Nativní rezervace založená tady by
 * snížila dostupné kusy na 0 a kontrola by odmítla i košík, který si kus
 * právě rezervoval; při dokončení objednávky totéž (`reserveInventoryStep`).
 *
 * ## Jak to je
 *
 * Kdo kus drží, je v **metadatech skladové položky** (`kz_cart_hold`) — ty
 * obchod přes veřejné API nevidí, takže id košíku (kdo ho zná, vidí adresu
 * a e-mail) neuteče. Zápis běží pod zámkem (`Modules.LOCKING`), dva košíky
 * ve stejné vteřině si kus nevezmou oba.
 *
 * Rezervace blokuje jen **přidání do košíku** jiným zákazníkem. Při
 * dokončení objednávky už rozhoduje sklad (kdo dřív zaplatí) — zablokovat
 * zaplacenou objednávku kvůli cizímu košíku by znamenalo vracet peníze.
 *
 * Rezervace přestane platit, když:
 * - uplyne 30 minut od přidání,
 * - košík kus už nemá (zákazník ho odebral) nebo je dokončený.
 */

export const CART_HOLD_MINUTES = 30
export const CART_HOLD_KEY = "kz_cart_hold"

export type CartHold = {
  cart_id: string
  variant_id: string
  until: string
}

export const newHold = (cartId: string, variantId: string, now: Date = new Date()): CartHold => ({
  cart_id: cartId,
  variant_id: variantId,
  until: new Date(now.getTime() + CART_HOLD_MINUTES * 60_000).toISOString(),
})

/** Blokuje tahle rezervace košík `cartId`? (Bez ohledu na obsah cizího košíku.) */
export const holdBlocks = (
  hold: Partial<CartHold> | null | undefined,
  cartId: string,
  now: Date = new Date()
): boolean => {
  if (!hold?.cart_id || !hold.until) return false
  if (hold.cart_id === cartId) return false
  const until = new Date(hold.until).getTime()
  return Number.isFinite(until) && until > now.getTime()
}

const casPraha = (iso: string) =>
  new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(new Date(iso))

/** Má cizí košík kus pořád v sobě (a není dokončený)? */
const cartStillHas = async (
  container: MedusaContainer,
  cartId: string,
  variantId: string
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "completed_at", "items.variant_id"],
    filters: { id: cartId },
  })
  const cart = (data as any[])[0]
  if (!cart || cart.completed_at) return false
  return (cart.items ?? []).some((item: any) => item?.variant_id === variantId)
}

type ClearanceTarget = {
  variantId: string
  productTitle: string
  inventoryItemId: string
}

const clearanceTargets = async (
  container: MedusaContainer,
  variantIds: string[]
): Promise<ClearanceTarget[]> => {
  if (!variantIds.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "manage_inventory",
      "product.title",
      "product.metadata",
      "inventory_items.inventory_item_id",
    ],
    filters: { id: variantIds },
  })
  return (data as any[]).flatMap((variant) => {
    if (!isClearanceProduct(variant.product) || !variant.manage_inventory) return []
    const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id
    if (!inventoryItemId) return []
    return [
      {
        variantId: variant.id,
        productTitle: variant.product?.title ?? "Kus",
        inventoryItemId,
      },
    ]
  })
}

/**
 * Přidání do košíku: poškozený kus si košík rezervuje na 30 minut. Když ho
 * má rezervovaný jiný košík (a pořád ho v něm má), přidání se odmítne
 * s časem, kdy se kus uvolní.
 */
export const claimClearanceHolds = async (
  container: MedusaContainer,
  cartId: string,
  variantIds: string[]
) => {
  const targets = await clearanceTargets(container, variantIds)
  if (!targets.length) return

  const inventory = container.resolve(Modules.INVENTORY) as any
  const locking = container.resolve(Modules.LOCKING) as any

  for (const target of targets) {
    await locking.execute(`kz-clearance-hold:${target.inventoryItemId}`, async () => {
      const item = await inventory.retrieveInventoryItem(target.inventoryItemId)
      const metadata = (item?.metadata ?? {}) as Record<string, unknown>
      const hold = metadata[CART_HOLD_KEY] as CartHold | null | undefined

      if (
        holdBlocks(hold, cartId) &&
        (await cartStillHas(container, hold!.cart_id, hold!.variant_id ?? target.variantId))
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `„${target.productTitle}" je jediný kus a právě ho má v košíku jiný zákazník. ` +
            `Pokud ho nekoupí, uvolní se nejpozději v ${casPraha(hold!.until)}.`
        )
      }

      await inventory.updateInventoryItems([
        {
          id: target.inventoryItemId,
          metadata: { ...metadata, [CART_HOLD_KEY]: newHold(cartId, target.variantId) },
        },
      ])
    })
  }
}

/** Po objednávce rezervaci zahodit — kus už je prodaný. */
export const releaseClearanceHolds = async (
  container: MedusaContainer,
  variantIds: string[]
) => {
  const targets = await clearanceTargets(container, variantIds)
  const inventory = container.resolve(Modules.INVENTORY) as any
  for (const target of targets) {
    const item = await inventory.retrieveInventoryItem(target.inventoryItemId)
    const metadata = (item?.metadata ?? {}) as Record<string, unknown>
    if (!metadata[CART_HOLD_KEY]) continue
    await inventory.updateInventoryItems([
      { id: target.inventoryItemId, metadata: { ...metadata, [CART_HOLD_KEY]: null } },
    ])
  }
}
