import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { ensureBalanceCollection, outstandingFor } from "../balance-payment"
import { balancePaymentUrl } from "../balance-payment-link"
import {
  customerName,
  emailLocaleForOrder,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../customer-email"
import { checkoutExtrasTotal } from "./commission-money"
import { localizedCommissionTitle } from "./commission-title-i18n"
import { clampContractPercentage } from "./contract-deposit"
import { buildCommissionConfirmation } from "../potvrzeni-zakazky"

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

/**
 * Co se uloží do `agreed_total` (6. 11. 2026).
 *
 * `agreed_total` NAHRAZUJE `original_total` — tak ho čte jediná definice
 * dluhu (`productionOutstanding` v `lib/ship-gate.ts`) i `commissionMoney`,
 * které od něj nesené „navíc" odečítá, aby dostalo cenu položky. V
 * `original_total` je u NOSNÉ zakázky kromě ceny kusu i doprava, balné a
 * běžné zboží objednávky — takže do `agreed_total` musí přijít taky, jinak
 * z dluhu beze zbytku vypadnou, zatímco jejich zaplacení se dál odečítá.
 *
 * Do 6. 11. 2026 se tu ukládala jen cena výrobku. U objednávky čistě na
 * zakázku s osobním odběrem je nesené „navíc" nula, takže se to nikdy
 * neprojevilo; v míchané objednávce vycházel dluh nižší, než byl.
 *
 * Lucie pořád zadává cenu VÝROBKU a strop zálohy (50 %, Z2) se počítá z ní —
 * poštovné ani balné zálohu nezvyšují. Tahle funkce jen dopočítá, co k ní
 * patří za objednávku.
 */
export const agreedTotalFor = (
  productionOrder: any,
  agreedPiecePrice: number
): number => round2(Number(agreedPiecePrice) + checkoutExtrasTotal(productionOrder))

/**
 * Záloha, kterou Lucie se zákazníkem domluvila.
 *
 * Do 30. 10. 2026 se zadávalo jen procento a částka z něj vyšla. Jenže
 * domluva u telefonu zní „dáte mi tisícovku", ne „dáte mi 38,4 %", takže se
 * teď zadává částka a procento se z ní dopočítá (ukládá se obojí — procento
 * nese zrušení zakázky a potvrzení zakázky).
 *
 * Strop drží na ceně VÝROBKU (Z2, § 1814 odst. 1 písm. l) OZ): poštovné ani
 * balné zálohu nezvyšují — jsou to náklady, ne část ceny díla.
 */
export const resolveAgreedDeposit = (input: {
  agreedTotal: number
  depositAmount?: number | null
  depositPercentage?: number | null
  storedPercentage?: unknown
}): { amount: number; percentage: number } => {
  const agreed = round2(Number(input.agreedTotal))
  const explicit = input.depositAmount

  if (explicit !== null && explicit !== undefined) {
    const amount = round2(Number(explicit))
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Záloha musí být kladná částka."
      )
    }
    const cap = round2(agreed / 2)
    if (amount > cap + 0.005) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Záloha může být nejvýš polovina ceny výrobku, tedy ${formatMoney(cap, "czk")}.`
      )
    }
    // Procento jen pro záznam — platí částka. Dolů na celé číslo v mezích
    // 1–50, ať uložený profil zůstane v tom, co dovolí DB check.
    return {
      amount,
      percentage: clampContractPercentage(Math.round((amount / agreed) * 100)),
    }
  }

  const percentage = clampContractPercentage(
    input.depositPercentage ?? input.storedPercentage
  )
  return { amount: round2((agreed * percentage) / 100), percentage }
}

export const sendAgreedPrice = async (
  container: MedusaContainer,
  input: {
    orderId: string
    productionOrder: any
    agreedTotal: number
    depositPercentage?: number | null
    /** Domluvená záloha v penězích — vyhrává nad procentem. */
    depositAmount?: number | null
    /** Poštovné, když se zákazník rozhodne nechat si kus poslat. */
    shippingTotal?: number | null
    /** Balné k té zásilce. */
    packagingTotal?: number | null
  }
): Promise<{
  productionOrder: any
  emailed: boolean
  depositAmount: number
}> => {
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
  const extra = (value: unknown, label: string): number => {
    if (value === null || value === undefined || value === "") return 0
    const amount = round2(Number(value))
    if (!Number.isFinite(amount) || amount < 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} nemůže být záporné.`)
    }
    return amount
  }
  const shipping = extra(input.shippingTotal, "Poštovné")
  const packaging = extra(input.packagingTotal, "Balné")

  /* Strop zálohy drží na ceně VÝROBKU (Z2) — `agreed`, ne celek s neseným. */
  const { amount: depositAmount, percentage } = resolveAgreedDeposit({
    agreedTotal: agreed,
    depositAmount: input.depositAmount,
    depositPercentage: input.depositPercentage,
    storedPercentage: po.deposit_percentage,
  })

  const updated = await madeToOrder.updateProductionOrders({
    id: po.id,
    agreed_total: agreedTotalFor(po, agreed),
    deposit_percentage: percentage,
    deposit_amount: depositAmount,
    shipping_total: shipping,
    packaging_total: packaging,
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
      // Jazyk zákazníka a přeložený název výrobku (lib/email-locale).
      "metadata",
      "shipping_address.country_code",
      "billing_address.country_code",
      "items.product_title",
      "items.product.metadata",
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
  /*
   * „Celkem" v e-mailu = co zákazník opravdu zaplatí, tedy dluh zakázky.
   * Tlačítko „zaplatit celé" účtuje přesně tohle, takže jiné číslo v e-mailu
   * by s ním nesedělo. U objednávky čistě na zakázku bez zaplacené zálohy to
   * vyjde stejně jako dřív (cena + poštovné + balné); v míchané objednávce se
   * tím odečte to, co zákazník zaplatil už v pokladně.
   */
  const total = owed
  const locale = await emailLocaleForOrder(container, order)
  const money = (value: number) => formatMoney(value, currency, locale)
  /*
   * Smlouva o dílo (Potvrzení zakázky) k domluvené ceně.
   *
   * Potvrzení z objednávky vzniklo, když cena ještě nebyla — kus se objednává
   * za 0 Kč a domlouvá se až tady. Dokument, který zákazník dostal, tedy
   * neobsahoval to hlavní: cenu, zálohu, poštovné a balné. Proto se k e-mailu
   * s domluvenou cenou přiloží potvrzení vyrobené ZNOVU, už s čísly, na
   * kterých jste se domluvili. Původní se nepřepíše — úložiště uloží pod
   * pevný klíč jen shodný obsah, jinak vznikne verze vedle (3. 11. 2026).
   *
   * Selhání PDF nesmí zastavit e-mail: bez ceny a platebního odkazu zákazník
   * neví, co má dělat; příloha je k tomu doklad navíc.
   */
  let smlouva: { filename: string; url: string } | null = null
  try {
    const built = await buildCommissionConfirmation(container, order.id, {
      productionOrderId: po.id,
    })
    smlouva = built.attachment
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `[zakázka] Potvrzení zakázky k domluvené ceně u ${order.id} se nepodařilo vyrobit: ${
          (error as Error)?.message ?? error
        } — e-mail jde bez něj.`
      )
  }

  const emailed = await sendCustomerEmail(container, {
    template: "commission-price-agreed",
    to: order.email,
    // Klíč nese všechny částky: opravené poštovné je nová zpráva, dvojklik
    // na totéž pořád jedna.
    key: `agreed-price:${po.id}:${agreed}:${shipping}:${packaging}:${depositAmount}`,
    orderId: order.id,
    locale,
    ...(smlouva ? { attachments: [smlouva] } : {}),
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      /* Šablona podle toho může říct, že je potvrzení v příloze. */
      contractAttached: Boolean(smlouva),
      productTitle: localizedCommissionTitle(order, updated, locale) ?? undefined,
      agreedPrice: money(agreed),
      depositAmount: money(depositAmount),
      depositPercentage: `${percentage} %`,
      // Doprava a balné se v e-mailu ukážou, jen když nějaké jsou —
      // u osobního odběru by řádky „0 Kč" jen mátly.
      shippingAmount: shipping > 0.005 ? money(shipping) : null,
      packagingAmount: packaging > 0.005 ? money(packaging) : null,
      totalAmount: money(total),
      balanceAmount:
        total - depositAmount > 0.005
          ? money(round2(total - depositAmount))
          : null,
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
