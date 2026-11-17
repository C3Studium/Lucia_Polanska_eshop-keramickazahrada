import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow, createOrderWorkflow } from "@medusajs/medusa/core-flows"
import initializeMerchantOrder from "../subscribers/initialize-merchant-order"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import {
  INQUIRY_ALREADY_ORDERED,
  inquirySnapshotCollectionMetadata,
  pickShippingOption,
  planInquiryOrder,
  type CreateInquiryOrderInput,
  type ShippingOptionLike,
} from "./commission-inquiry-order"
import { getInquiry, inquiryOrderOf, setInquiryOrder } from "./commission-inquiry-records"
import { sendAgreedPrice } from "./made-to-order/agreed-price"

/**
 * Založení objednávky z poptávky zakázky (17. 11. 2026) — zápisová polovina
 * k čistému plánu v `commission-inquiry-order.ts`.
 *
 * Pořadí kroků je schválně tohle:
 *
 *  1. objednávka (`createOrderWorkflow`) s jedním řádkem zakázky za 0 Kč
 *     a dopravou za 0 Kč — přesně jako objednávka výrobku s cenou po domluvě;
 *  2. platební kolekce za 0 Kč se snímkem `production_lines` (jako pokladna),
 *     připojená k objednávce — podle ní vznikne zakázka; nulová kolekce se
 *     v Meduse počítá jako zaplacená, takže objednávka začne v „Nové";
 *  3. zakázka HNED (subscriber `initialize-merchant-order` zavolaný přímo,
 *     je idempotentní) — aby šla poslat domluvená cena dřív, než doběhnou
 *     odběratelé události;
 *  4. `order.placed` — potvrzení zákazníkovi, upozornění majitelce s listem
 *     pro dílnu, souhlasy… (založení zakázky v odběrateli už nic neudělá);
 *  5. domluvená cena s odkazy k platbě (když je cena a majitelka chce poslat);
 *  6. odkaz na objednávku k poptávce (poptávka je tím vyřízená).
 *
 * Když selže krok 2 nebo 3, objednávka se zruší — poloviční objednávka bez
 * zakázky by v administraci jen mátla. Krok 5 už objednávku nezruší: cenu
 * jde poslat znovu z detailu objednávky a majitelka se to dozví z odpovědi.
 */

export type InquiryOrderResult = {
  order_id: string
  display_id: number | null
  emailed_price: boolean
  /** Česká věta, když něco po založení nevyšlo (cenu pak pošlete z objednávky). */
  warning: string | null
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") return Number(value) || 0
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>
    return toNumber(v.value ?? v.numeric_ ?? 0)
  }
  return 0
}

/** Region s Českem (CZK) a výchozí prodejní kanál obchodu. */
/**
 * Zákazník s účtem na webu (registrovaný, ne host) se stejným e-mailem.
 * Hostovské záznamy se přeskočí — objednávka bez účtu je běžná a host
 * ji vidí přes odkaz v e-mailu. Selhání hledání objednávku nezastaví.
 */
const accountCustomerId = async (
  container: MedusaContainer,
  email: string
): Promise<string | null> => {
  try {
    const customers = (await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ email: email.trim().toLowerCase() } as never)) as any[]
    return customers.find((customer) => customer?.has_account)?.id ?? null
  } catch {
    return null
  }
}

const shopContext = async (container: MedusaContainer) => {
  const regionModule: any = container.resolve(Modules.REGION)
  const regions: any[] = await regionModule.listRegions({}, { relations: ["countries"], take: 50 })
  const region =
    regions.find((r) => (r.countries ?? []).some((c: any) => String(c?.iso_2 ?? "").toLowerCase() === "cz")) ??
    regions.find((r) => String(r.currency_code ?? "").toLowerCase() === "czk")
  if (!region) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "V obchodě chybí region pro Česko.")
  }

  const storeModule: any = container.resolve(Modules.STORE)
  const [store] = await storeModule.listStores({}, { take: 1 })
  let salesChannelId: string | null = store?.default_sales_channel_id ?? null
  if (!salesChannelId) {
    const channels: any[] = await (container.resolve(Modules.SALES_CHANNEL) as any).listSalesChannels(
      {},
      { take: 1 }
    )
    salesChannelId = channels[0]?.id ?? null
  }
  return { region, salesChannelId }
}

const shippingOptions = async (container: MedusaContainer): Promise<ShippingOptionLike[]> => {
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  return fulfillment.listShippingOptions(
    {},
    { take: 500, relations: ["service_zone", "service_zone.geo_zones"] }
  )
}

export const createOrderFromInquiry = async (
  container: MedusaContainer,
  inquiryId: string,
  form: CreateInquiryOrderInput
): Promise<InquiryOrderResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const found = await getInquiry(container, inquiryId)
  if (!found) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tahle poptávka už neexistuje.")
  }
  if (inquiryOrderOf(found.data)) {
    throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, INQUIRY_ALREADY_ORDERED)
  }

  const option = pickShippingOption(await shippingOptions(container), form.delivery)
  if (!option) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      form.delivery === "pickup"
        ? "V obchodě chybí doprava „Osobní odběr“."
        : "V obchodě chybí doprava „Česká pošta — na adresu“."
    )
  }

  const plan = planInquiryOrder({ inquiry: found.record, form, shippingOption: option })
  if (!plan.email) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Doplňte e-mail zákazníka — na něj odejde potvrzení.")
  }

  const { region, salesChannelId } = await shopContext(container)
  const customerId = await accountCustomerId(container, plan.email)

  // 1) Objednávka.
  const { result: created } = await createOrderWorkflow(container).run({
    input: {
      region_id: region.id,
      // Má-li zákazník na webu účet se stejným e-mailem, objednávka se mu
      // ukáže v „Moje objednávky" jako každá jiná (17. 11. 2026).
      ...(customerId ? { customer_id: customerId } : {}),
      ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
      email: plan.email,
      currency_code: String(region.currency_code ?? "czk").toLowerCase(),
      status: "pending",
      shipping_address: plan.address,
      billing_address: plan.address,
      items: [plan.item],
      shipping_methods: [plan.shipping_method],
      metadata: plan.order_metadata,
    } as any,
  })
  const order: any = created
  const lineItemId: string | undefined = (order?.items ?? [])[0]?.id
  if (!order?.id || !lineItemId) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Objednávku se nepodařilo založit.")
  }

  try {
    // 2) Snímková kolekce za 0 Kč, připojená k objednávce.
    const payment: any = container.resolve(Modules.PAYMENT)
    const collection = await payment.createPaymentCollections({
      currency_code: String(order.currency_code ?? "czk").toLowerCase(),
      amount: 0,
      metadata: inquirySnapshotCollectionMetadata({
        lineItemId,
        depositPercentage: plan.deposit_percentage,
        specification: plan.specification,
        inquiryId,
      }),
    })
    const collectionId = Array.isArray(collection) ? collection[0]?.id : collection?.id
    await container.resolve(ContainerRegistrationKeys.LINK).create({
      [Modules.ORDER]: { order_id: order.id },
      [Modules.PAYMENT]: { payment_collection_id: collectionId },
    })

    // 3) Stav objednávky a zakázka hned.
    await initializeMerchantOrder({ event: { data: { id: order.id } }, container } as any)
  } catch (error) {
    logger.error(
      `[poptávka] Objednávku ${order.id} se nepodařilo dokončit, ruším ji: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    await cancelOrderWorkflow(container)
      .run({ input: { order_id: order.id } as any })
      .catch(() => undefined)
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Zakázku k objednávce se nepodařilo založit — objednávka je zrušená, zkuste to prosím znovu."
    )
  }

  // 6) Poptávka → objednávka (dřív než e-maily: druhý klik už nic nezaloží).
  const displayId = Number(order.display_id) || null
  await setInquiryOrder(container, inquiryId, {
    order_id: order.id,
    display_id: displayId,
    created_at: new Date().toISOString(),
  })

  // 4) Potvrzení zákazníkovi, upozornění majitelce, souhlasy…
  await container.resolve(Modules.EVENT_BUS).emit({ name: "order.placed", data: { id: order.id } })

  // 5) Domluvená cena s odkazy k platbě, nebo aspoň poznámka u zakázky.
  const madeToOrder: any = container.resolve(MADE_TO_ORDER_MODULE)
  const [productionOrder] = await madeToOrder.listProductionOrders({ order_id: order.id })
  let emailedPrice = false
  let warning: string | null = null

  if (productionOrder && plan.internal_note) {
    await madeToOrder
      .updateProductionOrders({ id: productionOrder.id, internal_note: plan.internal_note } as never)
      .catch(() => undefined)
  }
  if (productionOrder && plan.agreed_price) {
    try {
      const sent = await sendAgreedPrice(container, {
        orderId: order.id,
        productionOrder,
        agreedTotal: plan.agreed_price.price,
        depositPercentage: plan.agreed_price.deposit_percentage,
        shippingTotal: plan.agreed_price.shipping_total,
        packagingTotal: plan.agreed_price.packaging_total,
      })
      emailedPrice = sent.emailed
      if (!sent.emailed) {
        warning = "Objednávka je založená, ale e-mail s cenou neodešel. Pošlete ho z objednávky."
      }
    } catch (error) {
      logger.warn(
        `[poptávka] Cenu k objednávce ${order.id} se nepodařilo poslat: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      warning = "Objednávka je založená, ale cenu se nepodařilo poslat. Pošlete ji z objednávky."
    }
  }

  return {
    order_id: order.id,
    display_id: displayId ?? (toNumber(order.display_id) || null),
    emailed_price: emailedPrice,
    warning,
  }
}
