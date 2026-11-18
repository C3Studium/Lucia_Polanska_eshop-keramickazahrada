import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { updateSeasonalSelectionWorkflow } from "../workflows/manage-seasonal-selection"
import { isClearanceProduct } from "./clearance"
import { releaseClearanceHolds } from "./clearance-hold"
import { notifyMerchant } from "./notify"

/**
 * Poškozený kus po prodeji (18. 11. 2026, přání majitele: „smazat ho
 * doopravdy až po odeslání; po objednání jen měkce schovat, dokud se
 * neodešle — pak smazat úplně i se slevou").
 *
 * 1. **Objednáno** (`order.placed`) → měkké smazání: koncept (zmizí
 *    z obchodu), Archivované, pryč ze sezónních akcí, rezervace v košíku
 *    zahozena. Na výrobku zůstane `clearance_sold = { order_id, at }`.
 * 2. **Odesláno / vydáno** (odeslání zapsané u objednávky — balík předaný
 *    dopravci i vydání při osobním odběru jdou přes `createOrderShipment`,
 *    případně dokončená objednávka) → výrobek se smaže (`deleteProducts`,
 *    v Meduse je to měkké smazání s `deleted_at`, objednávky si údaje
 *    nechají). Jeho sleva odejde s ním (`product-sale-refresh` na
 *    `product.deleted`; sleva poškozeného kusu je v jeho metadatech).
 * 3. **Objednávka zrušená** dřív, než se kus odeslal → kus se vrátí do
 *    obchodu (publikovaný, bez archivu) a majitelka dostane zprávu.
 *
 * Krok 2 a 3 dělá `settleSoldClearance` — z událostí (odeslání, doručení,
 * dokončení, zrušení) a pro jistotu každou hodinu.
 */

export const SOLD_KEY = "clearance_sold"

export type SoldVerdict = "wait" | "delete" | "restore"

type OrderLike = {
  status?: string | null
  fulfillments?: Array<{
    shipped_at?: string | Date | null
    delivered_at?: string | Date | null
    canceled_at?: string | Date | null
  } | null> | null
} | null

export const soldClearanceVerdict = (order: OrderLike): SoldVerdict => {
  if (!order || order.status === "canceled") return "restore"
  if (order.status === "completed") return "delete"
  const left = (order.fulfillments ?? []).some(
    (fulfillment) =>
      !!fulfillment &&
      !fulfillment.canceled_at &&
      (!!fulfillment.shipped_at || !!fulfillment.delivered_at)
  )
  return left ? "delete" : "wait"
}

/** Vyndat výrobky ze všech běžících sezónních akcí. */
export const removeFromSeasonalSelections = async (
  container: MedusaContainer,
  productIds: string[]
) => {
  if (!productIds.length) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ids = new Set(productIds)
  const { data: selections } = await query.graph({
    entity: "seasonal_selection",
    fields: ["id", "publication_status", "items.id", "items.product_id"],
  })
  for (const selection of selections as any[]) {
    if (selection.publication_status === "archived") continue
    const items = selection.items || []
    const remaining = items.filter((item: any) => !ids.has(item.product_id))
    if (remaining.length === items.length) continue
    await updateSeasonalSelectionWorkflow(container).run({
      input: {
        id: selection.id,
        items: remaining.map((item: any) => ({ product_id: item.product_id })),
      },
    })
  }
}

/** Krok 1 — objednávka s poškozeným kusem: měkce smazat. */
export const markClearanceSold = async (container: MedusaContainer, orderId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "items.variant_id", "items.product_id"],
    filters: { id: orderId },
  })
  const order = (data as any[])[0]
  if (!order) return []

  const productIds = [
    ...new Set((order.items ?? []).map((item: any) => item?.product_id).filter(Boolean)),
  ] as string[]
  if (!productIds.length) return []

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "status", "metadata"],
    filters: { id: productIds },
  })
  const sold = (products as any[]).filter(isClearanceProduct)
  if (!sold.length) return []

  const at = new Date().toISOString()
  await updateProductsWorkflow(container).run({
    input: {
      products: sold.map((product) => ({
        id: product.id,
        status: "draft" as const,
        metadata: {
          ...(product.metadata ?? {}),
          archived: true,
          [SOLD_KEY]: { order_id: order.id, display_id: order.display_id ?? null, at },
        },
      })),
    },
  })

  await removeFromSeasonalSelections(
    container,
    sold.map((product) => product.id)
  )

  await releaseClearanceHolds(
    container,
    (order.items ?? []).map((item: any) => item?.variant_id).filter(Boolean)
  ).catch((error) =>
    logger.warn(`[clearance] Rezervaci v košíku se nepodařilo zahodit: ${String(error?.message ?? error)}`)
  )

  logger.info(
    `[clearance] Objednávka #${order.display_id}: ${sold
      .map((product) => product.title)
      .join(", ")} — schováno z obchodu, smaže se po odeslání.`
  )
  return sold.map((product) => product.id)
}

/*
 * Odeslání a dokončení objednávky přijdou skoro naráz (osobní odběr vydá
 * obojí) — běhy jdou za sebou, aby se tentýž kus nemazal dvakrát.
 */
let settling: Promise<unknown> = Promise.resolve()

/** Kroky 2 a 3 — prodané kusy podle stavu jejich objednávky. */
export const settleSoldClearance = (container: MedusaContainer) => {
  const run = settling.catch(() => undefined).then(() => settleOnce(container))
  settling = run
  return run
}

const settleOnce = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "status", "metadata"],
    filters: { status: "draft" },
    pagination: { take: 2000, skip: 0 },
  })
  const pending = (products as any[]).filter(
    (product) => isClearanceProduct(product) && (product.metadata ?? {})[SOLD_KEY]?.order_id
  )
  if (!pending.length) return { deleted: [], restored: [] }

  const orderIds = [...new Set(pending.map((product) => product.metadata[SOLD_KEY].order_id))]
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
    ],
    filters: { id: orderIds },
  })
  const byId = new Map((orders as any[]).map((order) => [order.id, order]))

  const deleted: any[] = []
  const restored: any[] = []
  for (const product of pending) {
    const sold = product.metadata[SOLD_KEY]
    const verdict = soldClearanceVerdict(byId.get(sold.order_id) ?? null)
    if (verdict === "delete") deleted.push(product)
    if (verdict === "restore") restored.push(product)
  }

  /* Po jednom: kus s ještě otevřenou rezervací (část objednávky neodeslaná)
     Medusa smazat odmítne — ten počká na další běh, ostatní se smažou. */
  const removed: any[] = []
  for (const product of deleted) {
    try {
      await deleteProductsWorkflow(container).run({ input: { ids: [product.id] } })
      removed.push(product)
      logger.info(
        `[clearance] Odesláno — smazáno i se slevou: ${product.title} (#${
          product.metadata[SOLD_KEY].display_id ?? "?"
        }).`
      )
    } catch (error) {
      logger.warn(
        `[clearance] ${product.title} zatím smazat nejde (zkusí se znovu): ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  if (restored.length) {
    await updateProductsWorkflow(container).run({
      input: {
        products: restored.map((product) => ({
          id: product.id,
          status: "published" as const,
          metadata: { ...(product.metadata ?? {}), archived: false, [SOLD_KEY]: null },
        })),
      },
    })
    logger.info(
      `[clearance] Objednávka zrušena — zpátky v obchodě: ${restored
        .map((product) => product.title)
        .join(", ")}.`
    )
    await notifyMerchant(container, {
      key: `mn:clearance-restored:${restored.map((product) => product.id).join(",")}`,
      title:
        restored.length === 1
          ? "Poškozený kus je zpátky v obchodě"
          : `${restored.length} poškozené kusy jsou zpátky v obchodě`,
      description: `${restored
        .map((product) => product.title)
        .slice(0, 5)
        .join(", ")} — objednávka byla zrušena dřív, než se kus odeslal, tak se zase prodává.`,
      audience: "owner",
    }).catch(() => undefined)
  }

  return {
    deleted: removed.map((product) => product.id),
    restored: restored.map((product) => product.id),
  }
}
