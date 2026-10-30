import { MedusaError } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  dobirkaFeeCompletionProblem,
  isDobirkaFeeLine,
} from "../../lib/dobirka-fee"
import { DOBIRKA_PICKUP_POINT_MESSAGE } from "../../lib/balikovna-point"
import { productsHaveMadeToOrder } from "../../lib/made-to-order-detection"
import { getMerchantSetting } from "../../lib/merchant-settings"
import { DOBIRKA_PROVIDER_ID, isPayLaterPaymentProvider } from "../../lib/ship-gate"
import { VOUCHER_LINE_KEYS, isGiftVoucherProduct } from "../../lib/gift-voucher-orders"

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
        "currency_code",
        "shipping_address.country_code",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
        "shipping_methods.shipping_option.provider_id",
        // Balíkovna do boxu: typ výdejny (metadata) a poznání Balíkovny.
        "shipping_methods.name",
        "shipping_methods.data",
        "metadata",
        "items.product_id",
        // Feeds the fee-line identity (marker + no product behind the line) —
        // a client-forged `dobirka_fee` marker on a variant line stays a
        // product here and keeps its `cod_allowed` check.
        "items.variant_id",
        "items.title",
        "items.quantity",
        "items.metadata",
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

    /*
     * Zakázková záloha je povinná a jen předem kartou.
     *
     * U zakázky (produkt s výrobním profilem) se platí záloha dopředu. Osobní
     * odběr i tak jde — zbytek se doplatí při vyzvednutí — ale ZÁLOHU je nutné
     * poslat kartou (ComGate / peněženka / banka) hned. „Zaplatíte při
     * vyzvednutí" ani dobírka zálohu nepokryjí: obě vybírají peníze až později,
     * takže by zakázka vznikla nezaplacená a majitelka by do ní šla naslepo.
     *
     * Pokladna tyhle dvě metody u zakázky vůbec nenabízí; tohle je zadní vrátka
     * pro ručně složený požadavek. Detekce zakázky jde přes výrobní profil, ne
     * přes `metadata.made_to_order` na řádku — ten se razí až v zálohovém toku,
     * kterým by obcházející košík právě neprošel (viz
     * `lib/made-to-order-detection.ts`).
     */
    const usesPayLater = sessions.some(
      (session: any) =>
        session?.status !== "canceled" &&
        isPayLaterPaymentProvider(session?.provider_id)
    )
    if (usesPayLater) {
      const productIds = [
        ...new Set(
          ((fullCart.items ?? []) as any[])
            .filter((item) => !isDobirkaFeeLine(item))
            .map((item) => item?.product_id)
            .filter(Boolean) as string[]
        ),
      ]
      if (await productsHaveMadeToOrder(container, productIds)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "U zakázky je záloha povinná a platí se předem kartou. Osobní odběr i dobírka zálohu nepokryjí — zvolte prosím platbu kartou (u osobního odběru pak zbytek doplatíte při vyzvednutí)."
        )
      }
    }

    /*
     * Doběrečné — the completion-time backstop. The fee line is added and
     * removed by `lib/dobirka-fee.ts` on the payment-session route; here is
     * where a cart that dodged that door (a crafted line-item delete, an old
     * cart from before the fee existed) gets stopped instead of underpaying —
     * and where a stray fee without dobírka gets stopped instead of
     * overcharging.
     */
    const items = (fullCart.items ?? []) as any[]
    const feeCzk = usesDobirka
      ? await getMerchantSetting(container, "dobirka_fee_czk")
      : 0
    const feeProblem = dobirkaFeeCompletionProblem({
      usesDobirka,
      currencyCode: fullCart.currency_code,
      feeCzk,
      items,
    })
    if (feeProblem) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, feeProblem)
    }

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

    /*
     * Balíkovna = žádná dobírka, na ŽÁDNÉ výdejní místo (Matěj, 11. 10. 2026).
     * Do boxu se dobírka platí jen předem kartou online, na poště a u partnera
     * se zase jen vyzvedává — kdo jde na výdejnu, platí kartou předem, aby si
     * zásilku jen vyzvedl. Dobírka zůstává jen pro doručení na adresu.
     * Pokladna ji u Balíkovny nenabízí; tohle je pojistka pro starý košík nebo
     * ručně složený požadavek.
     */
    const viaBalikovna = (fullCart.shipping_methods ?? []).some(
      (method: any) =>
        String(method?.data?.service_code ?? "").toUpperCase() === "NB" ||
        /bal[ií]kovn/i.test(String(method?.name ?? ""))
    )
    if (viaBalikovna) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, DOBIRKA_PICKUP_POINT_MESSAGE)
    }

    /*
     * Dárkový poukaz na dobírku nejde (30. 10. 2026): peníze by dorazily až
     * při předání zásilky, takže by poukaz do té doby nebyl platný
     * a elektronický by obdarovanému nepřišel vůbec — ten se posílá až po
     * zaplacení (`subscribers/gift-voucher-payment.ts`). Pokladna dobírku
     * u poukazu nenabízí; tohle je pojistka pro ručně složený požadavek.
     *
     * Rozhodují metadata řádku, a to před načtením produktů: poukaz s vlastní
     * částkou nese svou podobu na položce a kontrola nesmí propadnout ani
     * u košíku, ze kterého se žádný produkt nevyčte.
     */
    const voucherLine = items.some((item: any) => {
      const kind = item?.metadata?.[VOUCHER_LINE_KEYS.kind]
      return kind === "electronic" || kind === "physical"
    })
    if (voucherLine) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Dárkový poukaz se na dobírku neposílá — platí se předem, jinak by do převzetí zásilky nebyl platný. Zvolte prosím platbu kartou."
      )
    }

    // The fee line is ours, not a product: it has no product_id, but the
    // explicit marker filter keeps the intent readable and future-proof.
    const productIds = [
      ...new Set(
        items
          .filter((item: any) => !isDobirkaFeeLine(item))
          .map((item: any) => item?.product_id)
          .filter(Boolean) as string[]
      ),
    ]
    if (!productIds.length) return

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title", "metadata", "categories.handle"],
      filters: { id: productIds },
    })
    // Dobírka je VÝCHOZÍ (Matěj 12. 10. 2026): blokuje jen výslovně vypnutá
    // (`cod_allowed: false`), zakázka (kategorie Zakázková výroba nebo
    // značka; profil výroby hlídá kontrola výš) a dárkový poukaz.
    const blocked = (products as any[]).filter(
      (product) =>
        product?.metadata?.cod_allowed === false ||
        Boolean(product?.metadata?.made_to_order) ||
        isGiftVoucherProduct(product?.metadata) ||
        ((product?.categories ?? []) as any[]).some(
          (category) => category?.handle === "zakazkova-vyroba"
        )
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
