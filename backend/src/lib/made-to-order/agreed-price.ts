import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { ensureBalanceCollection, outstandingFor } from "../balance-payment"
import { balancePaymentUrl } from "../balance-payment-link"
import { customerName, formatMoney, orderLink, orderNumber, sendCustomerEmail } from "../customer-email"
import { clampContractPercentage } from "./contract-deposit"
import { commissionTitleOf } from "./commission-line"

/**
 * Cena po domluvě u zakázky — „Poslat domluvenou cenu" (24. 10. 2026, Matěj).
 *
 * Výrobek s cenou po domluvě (`lib/price-on-request.ts`) se objedná za 0 Kč,
 * takže zakázka vznikne s `original_total` 0 a bez zálohy. Až se Lucie se
 * zákazníkem domluví, zadá v administraci domluvenou cenu:
 *
 * - `agreed_total` = domluvená cena, `deposit_amount` = smluvní záloha
 *   (procento profilu, nejvýš 50 % — Z2), `final_total_confirmed_at` = teď,
 * - kolekce doplatku objednávky se srovná na dluh (nativní „Nesplacená částka"),
 * - zákazník dostane e-mail „Domluvená cena" se dvěma tlačítky: zaplatit
 *   zálohu (povinná) nebo rovnou celé. Obě vedou na
 *   `/made-to-order/:orderId/pay-balance` (`castka=zaloha` / bez), platba se
 *   zachytí do objednávky stejně jako doplatek zakázky.
 *
 * Výroba nezačne, dokud není zaplacená aspoň záloha (`assertDepositPaidForAgreedPrice`).
 * Poslat znovu (oprava ceny) jde, dokud výroba nezačala; e-mail má klíč podle
 * částky, takže jiná cena = nový e-mail, dvojklik = jeden.
 */

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Number(source.value ?? source.numeric_ ?? 0)
  }
  return Number(value ?? 0)
}
const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Zakázka z výrobku s cenou po domluvě = její položka byla objednaná za 0 Kč.
 * Podle `line_total` (cena položky), ne `original_total` — do toho se může
 * připočíst něco dalšího z objednávky; starší zakázky bez `line_total` podle něj.
 */
export const isAgreedPriceCommission = (productionOrder: any): boolean =>
  productionOrder?.line_total !== null && productionOrder?.line_total !== undefined
    ? toNumber(productionOrder.line_total) <= 0.005
    : toNumber(productionOrder?.original_total) <= 0.005

export const SEND_AGREED_PRICE_STAGES = ["specification_pending", "confirmed"]

export const sendAgreedPrice = async (
  container: MedusaContainer,
  input: {
    orderId: string
    productionOrder: any
    agreedTotal: number
    depositPercentage?: number | null
  }
): Promise<{ productionOrder: any; emailed: boolean; depositAmount: number }> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const po = input.productionOrder

  if (!SEND_AGREED_PRICE_STAGES.includes(po.stage)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Domluvenou cenu jde poslat jen před zahájením výroby."
    )
  }
  const agreed = round2(Number(input.agreedTotal))
  if (!Number.isFinite(agreed) || agreed <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Domluvená cena musí být kladná částka.")
  }
  const percentage = clampContractPercentage(input.depositPercentage ?? po.deposit_percentage)
  const depositAmount = round2((agreed * percentage) / 100)

  const updated = await madeToOrder.updateProductionOrders({
    id: po.id,
    agreed_total: agreed,
    deposit_percentage: percentage,
    deposit_amount: depositAmount,
    final_total_confirmed_at: new Date(),
  } as never)

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "items.id",
      "items.title",
      "items.variant_title",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.captured_amount",
      "payment_collections.metadata",
    ],
    filters: { id: input.orderId },
  })
  const order = (data?.[0] as any) ?? null
  if (!order) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")

  // Nativní „Nesplacená částka" = dluh zakázky (fail-open: cena je uložená i bez toho).
  const requests = (await madeToOrder.listProductionPaymentRequests({ production_order_id: po.id } as never)) as any[]
  const owed = outstandingFor(updated, requests)
  try {
    if (owed > 0.005) await ensureBalanceCollection(container, order, owed, po.id)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[zakázka] Kolekci doplatku u ${order.id} se po domluvené ceně nepodařilo srovnat: ${(error as Error)?.message ?? error}`)
  }

  const currency = order.currency_code || "czk"
  const emailed = await sendCustomerEmail(container, {
    template: "commission-price-agreed",
    to: order.email,
    key: `agreed-price:${po.id}:${agreed}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      productTitle: commissionTitleOf(order, updated) ?? undefined,
      agreedPrice: formatMoney(agreed, currency),
      depositAmount: formatMoney(depositAmount, currency),
      depositPercentage: `${percentage} %`,
      payDepositUrl: balancePaymentUrl(order.id, po.id, "deposit"),
      payFullUrl: balancePaymentUrl(order.id, po.id, "full"),
    },
  })

  return { productionOrder: updated, emailed, depositAmount }
}

/**
 * Z5 + povinná záloha: zakázku s cenou po domluvě nejde pustit do výroby,
 * dokud není domluvená cena poslaná a zaplacená aspoň záloha.
 */
export const assertDepositPaidForAgreedPrice = async (
  container: MedusaContainer,
  productionOrder: any
): Promise<void> => {
  if (!isAgreedPriceCommission(productionOrder)) return
  if (!(toNumber(productionOrder.agreed_total) > 0)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "U výrobku s cenou po domluvě nejdřív pošlete zákazníkovi domluvenou cenu."
    )
  }
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]
  const paid = requests.filter((r) => r.status === "paid").reduce((sum, r) => sum + toNumber(r.amount), 0)
  if (paid + 0.005 < toNumber(productionOrder.deposit_amount)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Zákazník ještě nezaplatil zálohu (${formatMoney(toNumber(productionOrder.deposit_amount), productionOrder.currency_code || "czk")}) — výroba může začít až po ní.`
    )
  }
}
