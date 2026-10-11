import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  deleteOrderPaymentCollections,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { BALANCE_COLLECTION_FLAG, findOpenBalanceCollection } from "../balance-payment"
import { toNumber } from "../order-quantity"

/**
 * Platby po zákaznické úpravě objednávky — co Medusa po potvrzení úpravy
 * udělá sama a proč to tady srovnáváme (změřeno v kódu Medusy 2.18,
 * `createOrUpdateOrderPaymentCollectionWorkflow`, 11. 10. 2026):
 *
 * 1. **Autorizovaná platba (dobírka, osobní odběr) se ZRUŠÍ** a vznikne nová
 *    nezaplacená kolekce na nový součet — bez platby. Objednávka by pak
 *    vypadala jako nezaplacená karta: štítek by odešel BEZ dobírky (razítko
 *    dobírky čte poskytovatele platby), brána odeslání by ji držela a
 *    „Vyzvednuto a zaplaceno" by nemělo co zapsat. Proto na novou kolekci
 *    znovu založíme tutéž platbu „až při převzetí" a autorizujeme ji — na
 *    nový součet, takže dobírka i odběr vyberou správnou částku.
 * 2. **Otevřená kolekce doplatku zakázky** se srovná na „zbývá doplatit"
 *    celé objednávky. U smíšené objednávky by zlevnění běžných kusů snížilo
 *    doplatek zakázky A ZÁROVEŇ bychom rozdíl vraceli — dvakrát. Běžné kusy
 *    se vyrovnávají hned (doplatek kartou / vrácení), doplatek zakázky zůstává
 *    na své částce: vracíme ho na hodnotu před úpravou.
 */

const PAY_LATER = /dobirka|pickup/i

/** Poskytovatel platby „až při převzetí" (dobírka / odběr), pokud objednávka má. */
export const payLaterProviderOf = (order: any): string | null => {
  const payment = ((order?.payment_collections ?? []) as any[])
    .flatMap((collection) => collection?.payments ?? [])
    .find((p: any) => !p?.canceled_at && PAY_LATER.test(String(p?.provider_id ?? "")))
  return payment ? String(payment.provider_id) : null
}

/** Částka otevřeného doplatku zakázky před úpravou (pro návrat po ní). */
export const balanceSnapshotOf = (order: any): { id: string; amount: number } | null => {
  const balance = findOpenBalanceCollection(order)
  return balance?.metadata?.[BALANCE_COLLECTION_FLAG]
    ? { id: String(balance.id), amount: toNumber(balance.amount) }
    : null
}

const loadCollections = async (container: MedusaContainer, orderId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.metadata",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.canceled_at",
      "payment_collections.payment_sessions.id",
      "payment_collections.payment_sessions.data",
    ],
    filters: { id: orderId },
  })
  return (((data as any[])[0]?.payment_collections ?? []) as any[])
}

const isOpen = (collection: any) =>
  ["not_paid", "awaiting"].includes(String(collection?.status ?? "").toLowerCase())

export type PaymentRepair = {
  pay_later: "kept" | "restored" | "missing" | null
  balance: "kept" | "restored" | null
}

/**
 * Po potvrzení úpravy: obnovit platbu „až při převzetí" a vrátit doplatek
 * zakázky (viz hlavička). Idempotentní — co už sedí, nechá být.
 */
export const repairPaymentsAfterEdit = async (
  container: MedusaContainer,
  orderId: string,
  before: { payLaterProvider: string | null; balance: { id: string; amount: number } | null }
): Promise<PaymentRepair> => {
  const repair: PaymentRepair = { pay_later: null, balance: null }
  let collections = await loadCollections(container, orderId)
  const paymentModule = container.resolve(Modules.PAYMENT) as any

  if (before.balance) {
    const balance = collections.find((collection) => collection.id === before.balance!.id)
    if (balance && isOpen(balance) && Math.abs(toNumber(balance.amount) - before.balance.amount) > 0.01) {
      await paymentModule.updatePaymentCollections({ id: balance.id }, { amount: before.balance.amount })
      repair.balance = "restored"
    } else {
      repair.balance = "kept"
    }
  }

  if (before.payLaterProvider) {
    const active = collections
      .flatMap((collection) => collection?.payments ?? [])
      .some((payment: any) => !payment?.canceled_at && payment?.provider_id === before.payLaterProvider)
    if (active) {
      repair.pay_later = "kept"
      return repair
    }
    const target = collections.find(
      (collection) =>
        isOpen(collection) &&
        !collection?.metadata?.[BALANCE_COLLECTION_FLAG] &&
        !((collection?.payments ?? []) as any[]).some((payment) => !payment?.canceled_at)
    )
    if (!target) {
      repair.pay_later = "missing"
      return repair
    }
    const { result: session } = await createPaymentSessionsWorkflow(container).run({
      input: { payment_collection_id: target.id, provider_id: before.payLaterProvider } as never,
    })
    await paymentModule.authorizePaymentSession((session as any).id, {})
    collections = await loadCollections(container, orderId)
    repair.pay_later = collections
      .flatMap((collection) => collection?.payments ?? [])
      .some((payment: any) => !payment?.canceled_at && payment?.provider_id === before.payLaterProvider)
      ? "restored"
      : "missing"
  }
  return repair
}

/**
 * Zrušená rozpracovaná úprava (zákazník rozdíl nezaplatil): nezaplacená
 * kolekce založená pro doplatek úpravy by jinak visela a objednávka by se
 * jevila jako nedoplacená. Pozná se podle `order_change_id` v datech relace.
 */
export const cancelEditPaymentCollections = async (
  container: MedusaContainer,
  orderId: string,
  changeId: string | null
): Promise<number> => {
  if (!changeId) return 0
  const collections = await loadCollections(container, orderId)
  // Smazat jde jen `not_paid` (Medusa `deleteOrderPaymentCollections`) —
  // přesně ta nezaplacená kolekce doplatku úpravy.
  const targets = collections.filter(
    (collection) =>
      String(collection?.status ?? "").toLowerCase() === "not_paid" &&
      ((collection?.payment_sessions ?? []) as any[]).some(
        (session) => session?.data?.order_change_id === changeId
      )
  )
  for (const collection of targets) {
    await deleteOrderPaymentCollections(container)
      .run({ input: { id: collection.id } as never })
      .catch(() => undefined)
  }
  return targets.length
}
