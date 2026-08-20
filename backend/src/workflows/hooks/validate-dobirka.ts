import { MedusaError } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { DOBIRKA_PROVIDER_ID } from "../../lib/ship-gate"

/**
 * Server-side dobírka rules, enforced where the order is born.
 *
 * Until now `cod_allowed` lived only in the admin UI and the order-EDIT route —
 * checkout itself never checked it, so a cart could complete with dobírka on a
 * product the owner explicitly flagged „nelze na dobírku". Same for the
 * config's claim that dobírka works „only inside Czechia": nothing enforced it.
 *
 * The `validate` hook runs before the order exists, so a violation is a clean
 * Czech error at the payment step, not a broken order to untangle.
 */
completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    const query = container.resolve("query")
    const cartId = (cart as { id?: string })?.id
    if (!cartId) return

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "shipping_address.country_code",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
        "shipping_methods.shipping_option.provider_id",
        "items.product_id",
        "items.title",
      ],
      filters: { id: cartId },
    })
    const fullCart = carts[0] as any
    if (!fullCart) return

    const sessions = fullCart.payment_collection?.payment_sessions ?? []
    const usesDobirka = sessions.some(
      (session: any) =>
        session?.provider_id === DOBIRKA_PROVIDER_ID &&
        session?.status !== "canceled"
    )
    if (!usesDobirka) return

    const country = String(
      fullCart.shipping_address?.country_code ?? ""
    ).toLowerCase()
    if (country !== "cz") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Dobírka funguje jen pro doručení v rámci České republiky. Zvolte prosím platbu kartou."
      )
    }

    // Dobírka rides on Česká pošta carriage only — a pickup or foreign carrier
    // has nobody standing at the door with a card terminal.
    const viaCeskaPosta = (fullCart.shipping_methods ?? []).some((method: any) =>
      String(method?.shipping_option?.provider_id ?? "").startsWith(
        "ceska-posta-fulfillment"
      )
    )
    if (!viaCeskaPosta) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Dobírka jde jen s dopravou Českou poštou. Zvolte prosím platbu kartou, nebo změňte dopravu."
      )
    }

    const productIds = [
      ...new Set(
        (fullCart.items ?? [])
          .map((item: any) => item?.product_id)
          .filter(Boolean) as string[]
      ),
    ]
    if (!productIds.length) return

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title", "metadata"],
      filters: { id: productIds },
    })
    // Opt-IN, same as the storefront reads it: dobírka only when EVERY piece
    // explicitly allows it. An unflagged product is a „ne".
    const blocked = (products as any[]).filter(
      (product) => product?.metadata?.cod_allowed !== true
    )
    if (blocked.length) {
      const names = blocked.map((product) => `„${product.title}"`).join(", ")
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${names} nelze poslat na dobírku. Zvolte prosím platbu kartou.`
      )
    }
  }
)
