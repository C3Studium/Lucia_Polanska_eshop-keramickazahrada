/**
 * `applyParcelEvents` — jedna cesta pro job i simulaci (docs/sledovani-zasilek.md §3).
 *
 * Rozhodování je v čistém `planParcelUpdate`; tady se plán zapíše a spustí
 * vedlejší účinky. Zápis jde PŘED účinky: fakta od ČP (razítka, historie)
 * nesmí přijít o to, že se nepovedl e-mail nebo workflow. Každý účinek je sám
 * idempotentní (shipment jen pro otevřený fulfillment, přechod fáze no-op na
 * stejné fázi, notifikace klíčované), a když spadne, zaloguje se a pošle
 * vývojáři — aby chyba byla vidět, ne aby sledování ztuhlo.
 *
 * ## Proč se brána vyhodnocuje PŘED vznikem shipmentu
 *
 * Kontrakt píše „(a) shipment, (b) fáze přes bránu". Jenže `shipment.created`
 * má dva posluchače: `reconcile-merchant-order` posune fázi na „odesláno" a
 * `customer-emails` pošle zákazníkovi „předáno dopravci" — bez ohledu na
 * bránu. Shipment vytvořený před bránou by tedy udělal přesně to, čemu má
 * brána zabránit u nezaplacené objednávky. Proto: brána nejdřív; projde →
 * shipment + fáze; neprojde → nic z toho, jen upozornění majitelce. Jediná
 * výjimka: fáze už je „odesláno" (lehké „Označit jako odeslané") — tam se
 * shipment založí bez brány, protože jde jen o doplnění `shipped_at`, které
 * tlačítko nevyplnilo (§0) a na kterém visí recenze i lhůta odstoupení.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"
import { MERCHANT_ORDER_MODULE } from "../../modules/merchant-order"
import type MerchantOrderModuleService from "../../modules/merchant-order/service"
import type { MerchantOrderStage } from "../../modules/merchant-order/stages"
import { PARCEL_TRACKING_MODULE } from "../../modules/parcel-tracking"
import type ParcelTrackingModuleService from "../../modules/parcel-tracking/service"
import { transitionMerchantOrderWorkflow } from "../../workflows/transition-merchant-order"
import { notifyMerchant } from "../notify"
import { loadShipGateInput } from "../require-ship-gate"
import { evaluateShipGate } from "../ship-gate"
import { cpTrackingUrl } from "./carrier"
import { classifyState, PHASE_LABEL, type ParcelPhase } from "./classify"
import type { ParcelEventInput } from "./client"
import { planParcelUpdate, type ParcelEventSource, type ParcelPlan } from "./plan"

/** Kdo je v historii fáze podepsaný pod automatickým přechodem. */
export const TRACKING_ACTOR = "cp-tracking"

export type ApplyParcelEventsResult = {
  tracking: any
  plan: ParcelPlan
  /** Co se opravdu stalo — do logu jobu a odpovědi route. */
  actions: string[]
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "items.id",
  "items.quantity",
  "items.requires_shipping",
  "items.detail.shipped_quantity",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.canceled_at",
]

const loadOrder = async (container: MedusaContainer, orderId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (data[0] as any) ?? null
}

const stageOf = async (
  container: MedusaContainer,
  orderId: string
): Promise<MerchantOrderStage | null> => {
  const service = container.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const states = await service.listMerchantOrderStates({ order_id: orderId })
  return (states[0]?.stage as MerchantOrderStage) ?? null
}

/**
 * Shipment pro otevřený (nezrušený, neodeslaný) fulfillment — jako
 * `confirm-merchant-handover`. Bez otevřeného fulfillmentu nic: buď zásilka
 * už odešla (shipped_at je), nebo se nikdy nezabalila (nic k odeslání).
 */
const createShipmentForOpenFulfillment = async (
  container: MedusaContainer,
  order: any
): Promise<{ created: boolean; reason: string }> => {
  const allItems = (order?.items || []) as any[]
  const items = allItems
    .filter((item) => item?.requires_shipping)
    .map((item) => ({
      id: item.id,
      quantity: toNumber(item.quantity) - toNumber(item.detail?.shipped_quantity),
    }))
    .filter((item) => item.quantity > 0)

  const fulfillments = (order?.fulfillments || []) as any[]
  const open = fulfillments.find(
    (fulfillment) => !fulfillment?.canceled_at && !fulfillment?.shipped_at
  )
  // Důvod se vrací slovy — bez něj se „shipment nevznikl" nedá rozlišit od
  // „nebylo co odesílat" (změřeno 9. 10. 2026 na #36, kde oboje existovalo).
  if (!open?.id) {
    return {
      created: false,
      reason: `bez otevřeného fulfillmentu (fulfillmentů ${fulfillments.length})`,
    }
  }
  if (!items.length) {
    return {
      created: false,
      reason: `žádné položky k odeslání (položek ${allItems.length}, requires_shipping ${allItems.filter((item) => item?.requires_shipping).length})`,
    }
  }

  await createOrderShipmentWorkflow(container).run({
    input: {
      order_id: order.id,
      fulfillment_id: open.id,
      items,
      created_by: TRACKING_ACTOR,
    },
  })
  return { created: true, reason: `shipment ${open.id}, položek ${items.length}` }
}

/** První `21`: shipment + fáze „odesláno" za bránou — viz hlavičku souboru. */
const onHandedOver = async (
  container: MedusaContainer,
  tracking: any,
  actions: string[]
) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const order = await loadOrder(container, tracking.order_id)
  if (!order) {
    logger.warn(
      `[sledování] Zásilka ${tracking.parcel_code} podaná, ale objednávka ${tracking.order_id} neexistuje.`
    )
    return
  }
  const number = `#${order.display_id ?? ""}`

  if (order.status === "canceled") {
    actions.push("objednávka zrušená — bez změny")
    await notifyMerchant(container, {
      key: `mn:cp-handover-cancelled:${order.id}`,
      title: `ČP převzala zásilku zrušené objednávky ${number}`,
      description:
        "Objednávka je zrušená, ale Česká pošta hlásí podání zásilky. Zkontrolujte, co odešlo.",
      audience: "owner",
      urgent: true,
      resource: { id: order.id, type: "order" },
    })
    return
  }

  const stage = (await stageOf(container, order.id)) ?? "received"
  if (stage === "cancelled") {
    actions.push("fronta: zrušeno — bez změny")
    return
  }

  if (stage === "shipped") {
    // Už označeno jako odeslané (lehké tlačítko) — jen doplnit shipped_at.
    // Fáze se nemění (no-op) a e-mail „odesláno" je deduplikovaný klíčem.
    const shipment = await createShipmentForOpenFulfillment(container, order)
    actions.push(
      shipment.created
        ? `shipment doplněn (fáze už odesláno; ${shipment.reason})`
        : `fáze už odesláno; ${shipment.reason}`
    )
    return
  }

  const gateInput = await loadShipGateInput(container, order.id)
  const verdict = gateInput
    ? evaluateShipGate(gateInput)
    : { allowed: false, code: null, reason: "Objednávku se nepodařilo načíst." }

  if (!verdict.allowed) {
    actions.push(`brána: ${verdict.code ?? "chyba"} — fáze beze změny`)
    await notifyMerchant(container, {
      key: `mn:cp-handover-unpaid:${order.id}`,
      title: `ČP převzala zásilku ${number}, ale objednávka není zaplacená`,
      description:
        `${verdict.reason ?? "Platba není v pořádku."} Fáze zůstává beze změny a ` +
        `zákazníkovi „předáno dopravci" neodešlo. Až bude zaplaceno, použijte ` +
        `„Označit jako odeslané".`,
      audience: "owner",
      urgent: true,
      resource: { id: order.id, type: "order" },
    })
    return
  }

  const shipment = await createShipmentForOpenFulfillment(container, order)
  actions.push(shipment.created ? `shipment vytvořen (${shipment.reason})` : shipment.reason)

  // Posun fáze rovnou (reconcile = hlásíme fakt, ne přání): subscriber na
  // shipment.created by to udělal taky, ale bez fulfillmentu žádný shipment
  // není a e-mail „předáno dopravci" visí právě na téhle změně fáze.
  await transitionMerchantOrderWorkflow(container).run({
    input: {
      order_id: order.id,
      stage: "shipped",
      changed_by: TRACKING_ACTOR,
      reconcile: true,
    },
  })
  actions.push("fáze → odesláno")
}

/**
 * Zapíše události a spustí, co z nich plyne. Idempotentní: druhé volání se
 * stejnými událostmi nic nezmění a nic nepošle.
 */
export const applyParcelEvents = async (
  container: MedusaContainer,
  tracking: any,
  events: ParcelEventInput[],
  source: ParcelEventSource
): Promise<ApplyParcelEventsResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<ParcelTrackingModuleService>(
    PARCEL_TRACKING_MODULE
  )

  const plan = planParcelUpdate(tracking, events, source)
  const updated = await service.updateParcelTrackings({
    id: tracking.id,
    ...plan.patch,
  } as never)

  const actions: string[] = []
  if (plan.newEvents.length) {
    actions.push(`${plan.newEvents.length} nových událostí`)
  }
  const number = `#${updated.order_id}`

  const run = async (label: string, effect: () => Promise<void>) => {
    try {
      await effect()
    } catch (error) {
      const message = (error as Error)?.message ?? String(error)
      logger.error(
        `[sledování] ${label} u zásilky ${updated.parcel_code} selhalo: ${message}`
      )
      actions.push(`${label}: chyba`)
      await notifyMerchant(container, {
        key: `mn:cp-tracking-fail:${updated.order_id}:${label}`,
        title: `Sledování zásilky: ${label} selhalo`,
        description: `Objednávka ${updated.order_id}, zásilka ${updated.parcel_code}: ${message}`,
        audience: "dev",
        urgent: true,
        resource: { id: updated.order_id, type: "order" },
      }).catch(() => undefined)
    }
  }

  if (plan.triggers.handed_over) {
    await run("předání dopravci", () => onHandedOver(container, updated, actions))
  }

  // Každá změna fáze = e-mail majitelce (přání 9. 10. 2026: „ať se na e-mailu
  // obchodu pozná, že sledování téhle objednávky funguje"). Klíč na fázi, takže
  // opakovaný dotaz se stejným stavem nic nepošle; simulace je v titulku
  // označená, aby se v poště nepletla s ostrou zásilkou.
  const previousPhase = (tracking.phase ?? "label") as ParcelPhase
  const currentPhase = (updated.phase ?? previousPhase) as ParcelPhase
  if (currentPhase !== previousPhase) {
    await run("e-mail majitelce o fázi", async () => {
      const order = await loadOrder(container, updated.order_id)
      const display = order?.display_id ? `#${order.display_id}` : number
      const last = plan.newEvents[plan.newEvents.length - 1]
      const when = [last?.date, last?.postoffice].filter(Boolean).join(", ")
      await notifyMerchant(container, {
        key: `mn:cp-phase:${updated.order_id}:${currentPhase}`,
        title: `Zásilka ${display} (${updated.parcel_code}): ${PHASE_LABEL[currentPhase]}${
          source === "simulated" ? " — simulace" : ""
        }`,
        description:
          `Česká pošta hlásí: ${last?.text ?? updated.last_state_text ?? PHASE_LABEL[currentPhase]}` +
          `${when ? ` (${when})` : ""}. Sledování: ${cpTrackingUrl(updated.parcel_code)}`,
        audience: "owner",
        email: true,
        resource: { id: updated.order_id, type: "order" },
      })
      actions.push(`majitelka: ${PHASE_LABEL[currentPhase]}`)
    })
  }

  if (plan.triggers.returned) {
    await run("upozornění na vrácení", async () => {
      const order = await loadOrder(container, updated.order_id)
      const display = order?.display_id ? `#${order.display_id}` : number
      await notifyMerchant(container, {
        key: `mn:cp-returned:${updated.order_id}`,
        title: `Zásilka ${display} se vrací / vrátila`,
        description: `Česká pošta hlásí: ${updated.last_state_text ?? "vrácená zásilka"}. Zásilka ${updated.parcel_code}.`,
        audience: "owner",
        urgent: true,
        resource: { id: updated.order_id, type: "order" },
      })
      actions.push("majitelka: vrácení")
    })
  }

  if (plan.triggers.damaged) {
    await run("upozornění na poškození", async () => {
      const order = await loadOrder(container, updated.order_id)
      const display = order?.display_id ? `#${order.display_id}` : number
      // „Problém" není jen poškození (8E z veřejného sledování) — z nAPI je to
      // i ÚLOŽNA (nevyzvednuto, čeká na vrácení). Titulek nese text ČP.
      const problemEvent =
        [...plan.newEvents]
          .reverse()
          .find((event) => classifyState(event.id, event.text).kind === "problem") ??
        plan.newEvents[plan.newEvents.length - 1]
      await notifyMerchant(container, {
        // Na den — další hlášení téhož problému v jiný den projde.
        key: `mn:cp-damaged:${updated.order_id}:${problemEvent?.date ?? "x"}`,
        title: `ČP hlásí problém se zásilkou ${display}: ${problemEvent?.text ?? "Poškozená"}`,
        description: `Zásilka ${updated.parcel_code}: ${problemEvent?.text ?? "Poškozená"}. Sledování pokračuje — zjistěte u ČP, co se stalo.`,
        audience: "owner",
        urgent: true,
        resource: { id: updated.order_id, type: "order" },
      })
      actions.push("majitelka: poškození")
    })
  }

  if (plan.triggers.never_appeared) {
    await run("upozornění: zásilka se neobjevila", async () => {
      const order = await loadOrder(container, updated.order_id)
      const display = order?.display_id ? `#${order.display_id}` : number
      await notifyMerchant(container, {
        key: `mn:cp-never-appeared:${updated.order_id}`,
        title: `Zásilka ${display} se u České pošty neobjevila`,
        description:
          `Štítek ${updated.parcel_code} je 30 dnů starý a ČP zásilku stále nezná. ` +
          "Balík nejspíš neodešel — zkontrolujte, zda nezůstal v ateliéru. Sledování skončilo.",
        audience: "owner",
        urgent: true,
        resource: { id: updated.order_id, type: "order" },
      })
      actions.push("majitelka: neobjevila se")
    })
  }

  return { tracking: updated, plan, actions }
}
