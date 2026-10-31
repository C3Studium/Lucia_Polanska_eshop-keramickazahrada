import type { MedusaContainer } from "@medusajs/framework/types"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { isPersonalPickupOrder } from "./personal-pickup"
import { VOUCHER_LINE_KEYS, isGiftVoucherProduct } from "./voucher"

/**
 * Vytištěný poukaz se jen vyzvedává — jinak se překlopí na elektronický.
 *
 * Rozhodnutí majitelky (31. 10. 2026): kartičku dává do ruky v dílně, do
 * balíku ji nepřikládá. Zákazník si ale podobu poukazu volí v košíku, dávno
 * předtím, než vybere dopravu — a když pak zvolí Českou poštu, zůstal by
 * v objednávce „vytištěný" poukaz, který nemá jak doputovat. Výsledkem byla
 * objednávka, kterou nejde vyřídit, aniž by někdo zavolal zákazníkovi.
 *
 * Proto se podoba srovnává podle dopravy: jakmile je na košíku jiná doprava
 * než osobní odběr, každý vytištěný poukaz se stane elektronickým (a tím
 * i přestane chtít dopravu — `requires_shipping`). Opačný směr se NEDĚLÁ:
 * kdo si zvolil elektronický, chce ho e-mailem, i když si pro zbytek
 * objednávky přijede.
 *
 * ## Proč přes modul košíku, a ne `updateLineItemInCartWorkflow`
 *
 * Ten workflow ověřuje cenu varianty a poukaz s vlastní částkou má cenu
 * ručně nastavenou (`is_custom_price`) — viz stejná past u zadání zakázky
 * (`api/store/carts/:id/line-items/:line_id/brief`). Podoba ani dopravní
 * příznak s cenou nehýbou, takže se zapisují přímo.
 */

const CART_FIELDS = [
  "id",
  "items.id",
  "items.metadata",
  "items.requires_shipping",
  "items.product.metadata",
  "shipping_methods.id",
  "shipping_methods.name",
  "shipping_methods.data",
]

/** Řádek s vytištěným poukazem, který už nemá jak doputovat. */
export const printedVoucherLines = (cart: any): any[] =>
  ((cart?.items ?? []) as any[]).filter(
    (item) =>
      isGiftVoucherProduct(item?.product?.metadata) &&
      item?.metadata?.[VOUCHER_LINE_KEYS.kind] === "physical"
  )

/**
 * Má se podoba překlopit? Jen když je doprava ZVOLENÁ a není to odběr —
 * košík bez dopravy se ještě rozhoduje a nemá se mu do volby sahat.
 */
export const shippingForcesElectronic = (cart: any): boolean =>
  ((cart?.shipping_methods ?? []) as any[]).length > 0 &&
  !isPersonalPickupOrder(cart)

export const syncVoucherKindToShipping = async (
  container: MedusaContainer,
  cartId: string
): Promise<number> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: CART_FIELDS,
    filters: { id: cartId },
  })
  const cart = carts[0] as any
  if (!cart || !shippingForcesElectronic(cart)) return 0

  const lines = printedVoucherLines(cart)
  if (!lines.length) return 0

  const cartModule = container.resolve(Modules.CART)
  await cartModule.updateLineItems(
    lines.map((line) => ({
      selector: { id: line.id },
      data: {
        /* Metadata se slučují po klíčích, takže stačí přepsat podobu —
           obdarovaný, věnování i jméno zůstávají (lib/voucher.ts). */
        metadata: { ...(line.metadata ?? {}), [VOUCHER_LINE_KEYS.kind]: "electronic" },
        requires_shipping: false,
      },
    }))
  )

  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(
      `[poukazy] Košík ${cartId}: ${lines.length}× vytištěný poukaz překlopen na elektronický — zvolená doprava není osobní odběr.`
    )

  return lines.length
}

/**
 * Srovnání při čtení košíku — stejné místo, kde se srovnává balné.
 *
 * Doprava se dá nastavit víc cestami (pokladna, express, úprava objednávky),
 * takže překlopení nevisí na jedné z nich: košík se po každé změně znovu
 * čte, a tím se podoba poukazu srovná vždycky. Selhání se jen zaloguje —
 * radši košík s nesrovnanou podobou než košík, který se nenačte.
 */
export const syncVoucherKindOnCartRead = () => {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      if (req.params.id) {
        await syncVoucherKindToShipping(req.scope, req.params.id)
      }
    } catch (error) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[poukazy] Srovnání podoby poukazu v košíku ${req.params.id} selhalo: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
    }
    next()
  }
}
