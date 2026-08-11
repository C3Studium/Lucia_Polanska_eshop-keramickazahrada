import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  beginOrderEditOrderWorkflow,
  cancelBeginOrderEditWorkflow,
  confirmOrderEditRequestWorkflow,
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
  orderEditAddNewItemWorkflow,
  orderEditUpdateItemQuantityWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  decideSettlement,
  validateEditActions,
  type EditAction,
} from "../../../../../lib/order-edit-rules"
import { paymentUrlFromSession } from "../../../../../lib/balance-payment"
import { notifyMerchant } from "../../../../../lib/notify"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../../modules/merchant-order/service"

/**
 * Zákaznická editace objednávky (Matěj, 2026-08-07).
 *
 * GET  — co jde upravit: řádky s příznakem editovatelnosti, varianty téhož
 *        produktu s cenami, způsob platby, případná rozpracovaná změna.
 * POST — dávka akcí (swap / remove / add) v JEDNOM tahu: begin → akce →
 *        preview → vyrovnání podle matice. Karta+dráž: změna zůstane čekat
 *        a vrátíme payment_url — POTVRDÍ ji až zaplacený webhook, takže
 *        nezaplacená úprava nikdy neexistuje. Jinak potvrzeno hned.
 * DELETE — zákazník si to rozmyslel: zruší JEHO čekající změnu.
 *
 * Tři zákony hlídá `order-edit-rules` (zakázky ne; nesmí zbýt prázdno;
 * peníze podle matice) — server je soudce, UI jen nápověda.
 */

const PostSchema = z.object({
  actions: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("swap"), item_id: z.string(), variant_id: z.string() }),
        z.object({ type: z.literal("remove"), item_id: z.string() }),
        z.object({ type: z.literal("add"), variant_id: z.string(), quantity: z.number().int().min(1).max(20) }),
      ])
    )
    .min(1)
    .max(10),
})

const loadOwnOrder = async (req: AuthenticatedMedusaRequest, orderId: string) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Přihlaste se prosím.")
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "customer_id", "email", "currency_code", "total",
      "items.id", "items.title", "items.quantity", "items.variant_id",
      "items.product_id", "items.unit_price", "items.metadata",
      "shipping_methods.shipping_option.provider_id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.amount",
      "fulfillments.id", "fulfillments.canceled_at",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order || order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return order
}

const paymentKind = (order: any): "card" | "pickup" | "dobirka" => {
  const providers = (order.payment_collections ?? [])
    .flatMap((c: any) => c?.payments ?? [])
    .map((p: any) => String(p?.provider_id ?? ""))
  if (providers.some((p: string) => p.includes("dobirka"))) return "dobirka"
  if (providers.some((p: string) => p.includes("pickup"))) return "pickup"
  return "card"
}

const editabilityGate = async (req: AuthenticatedMedusaRequest, order: any) => {
  // Co je zabalené, to jede: editovat jde jen v Nové/Připravujeme.
  const merchant = req.scope.resolve<MerchantOrderModuleService>(MERCHANT_ORDER_MODULE)
  const [state] = (await merchant.listMerchantOrderStates({ order_id: order.id } as never)) as any[]
  const stage = state?.stage ?? "received"
  if (!["received", "working"].includes(stage)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Objednávka už se chystá na cestu — úpravy vyřešíme po telefonu."
    )
  }
  if ((order.fulfillments ?? []).some((f: any) => !f?.canceled_at)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Část objednávky je už vypravená — úpravy vyřešíme po telefonu."
    )
  }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const order = await loadOwnOrder(req, req.params.id)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let editable = true
  let reason: string | null = null
  try {
    await editabilityGate(req, order)
  } catch (error) {
    editable = false
    reason = error instanceof Error ? error.message : null
  }

  // Varianty stejného produktu = nabídka pro „změnit barvu".
  const productIds = [...new Set((order.items ?? []).map((i: any) => i.product_id).filter(Boolean))]
  const { data: products } = productIds.length
    ? await query.graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.title", "variants.prices.amount", "variants.prices.currency_code"],
        filters: { id: productIds } as never,
      })
    : { data: [] as any[] }
  const variantsByProduct = new Map(
    (products as any[]).map((p) => [
      p.id,
      (p.variants ?? []).map((v: any) => ({
        id: v.id,
        title: v.title,
        price_czk:
          Number(
            (v.prices ?? []).find(
              (pr: any) => String(pr.currency_code).toLowerCase() === "czk"
            )?.amount
          ) || null,
      })),
    ])
  )

  // Rozpracovaná (nezaplacená) změna od zákazníka?
  const { data: changes } = await query
    .graph({
      entity: "order_change",
      fields: ["id", "status", "created_at", "metadata"],
      filters: { order_id: order.id } as never,
    })
    .catch(() => ({ data: [] as any[] }))
  const pending = (changes as any[]).find(
    (c) => ["pending", "requested"].includes(c.status) && (c.metadata as any)?.customer_edit
  )

  res.status(200).json({
    editable,
    reason,
    payment: paymentKind(order),
    currency_code: order.currency_code,
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      variant_id: item.variant_id,
      unit_price: Number(item.unit_price) || 0,
      is_made_to_order: Boolean((item.metadata as any)?.made_to_order),
      variants: variantsByProduct.get(item.product_id) ?? [],
    })),
    pending_change: pending ? { id: pending.id, awaiting_payment: true } : null,
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const parsed = PostSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neplatný požadavek na úpravu.")
  }
  const actions = parsed.data.actions as EditAction[]

  const order = await loadOwnOrder(req, req.params.id)
  await editabilityGate(req, order)

  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const lines = (order.items ?? []).map((item: any) => ({
    id: item.id,
    quantity: item.quantity,
    is_made_to_order: Boolean((item.metadata as any)?.made_to_order),
  }))
  const verdict = validateEditActions(lines, actions)
  if (verdict.ok === false) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, verdict.reason)
  }

  // Přidávané/měněné varianty: žádné zakázky; do dobírky jen cod_allowed.
  const addVariantIds = actions
    .filter((a): a is Extract<EditAction, { type: "add" | "swap" }> => a.type === "add" || a.type === "swap")
    .map((a) => a.variant_id)
  if (addVariantIds.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "product_id", "product.metadata"],
      filters: { id: addVariantIds } as never,
    })
    const productIds = (variants as any[]).map((v) => v.product_id).filter(Boolean)
    const profiles = productIds.length
      ? ((await madeToOrder.listProductProductionProfiles({ product_id: productIds } as never)) as any[])
      : []
    const mtoProducts = new Set(profiles.filter((p) => p.enabled).map((p) => p.product_id))
    for (const variant of variants as any[]) {
      if (mtoProducts.has(variant.product_id)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Zakázková výroba se do objednávky nepřikupuje — vytvořte novou objednávku, ať se domluvíme na zadání."
        )
      }
      if (
        paymentKind(order) === "dobirka" &&
        !Boolean((variant.product?.metadata as any)?.cod_allowed)
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Tento produkt nejde poslat na dobírku — objednejte ho prosím zvlášť."
        )
      }
    }
  }

  const { result: change } = await beginOrderEditOrderWorkflow(req.scope).run({
    input: {
      order_id: order.id,
      metadata: { customer_edit: true, requested_by: order.customer_id },
    } as never,
  })

  try {
    for (const action of actions) {
      if (action.type === "remove") {
        await orderEditUpdateItemQuantityWorkflow(req.scope).run({
          input: { order_id: order.id, items: [{ id: action.item_id, quantity: 0 }] } as never,
        })
      } else if (action.type === "swap") {
        await orderEditUpdateItemQuantityWorkflow(req.scope).run({
          input: { order_id: order.id, items: [{ id: action.item_id, quantity: 0 }] } as never,
        })
        const original = (order.items ?? []).find((i: any) => i.id === action.item_id)
        await orderEditAddNewItemWorkflow(req.scope).run({
          input: {
            order_id: order.id,
            items: [{ variant_id: action.variant_id, quantity: original?.quantity ?? 1 }],
          } as never,
        })
      } else {
        await orderEditAddNewItemWorkflow(req.scope).run({
          input: { order_id: order.id, items: [{ variant_id: action.variant_id, quantity: action.quantity }] } as never,
        })
      }
    }

    const orderModule = req.scope.resolve(Modules.ORDER) as any
    const preview = await orderModule.previewOrderChange(order.id)
    const toNum = (v: unknown) =>
      Number(typeof v === "object" && v !== null ? ((v as any).value ?? (v as any).numeric_ ?? 0) : v) || 0
    const difference = Math.round((toNum(preview?.total) - toNum(order.total)) * 100) / 100
    const settlement = decideSettlement(difference, paymentKind(order))

    if (settlement.kind === "collect") {
      const { result: collections } = await createOrderPaymentCollectionWorkflow(req.scope).run({
        input: { order_id: order.id, amount: settlement.amount } as never,
      })
      const collection = (collections as any[])[0]
      const { result: session } = await createPaymentSessionsWorkflow(req.scope).run({
        input: {
          payment_collection_id: collection.id,
          provider_id: "pp_comgate_comgate",
          data: {
            method: "ALL",
            email: order.email,
            country_code: "CZ",
            label: `Obj. ${order.display_id}`.slice(0, 16),
            name: `Doplatek úpravy objednávky ${order.display_id}`,
            lang: "cs",
            order_change_id: change.id,
            order_id: order.id,
            edit_difference: settlement.amount,
          },
        } as never,
      })
      const paymentUrl = paymentUrlFromSession(session)
      if (!paymentUrl) throw new Error("ComGate nevrátil platební odkaz.")

      res.status(200).json({
        status: "awaiting_payment",
        difference,
        payment_url: paymentUrl,
        message: `Změna je připravená — dokončí se zaplacením rozdílu ${settlement.amount} Kč.`,
      })
      return
    }

    await confirmOrderEditRequestWorkflow(req.scope).run({
      input: { order_id: order.id, confirmed_by: order.customer_id } as never,
    })

    await notifyMerchant(req.scope, {
      key: `customer-edit:${(change as any).id ?? order.id}`,
      title: `Zákazník upravil objednávku #${order.display_id}`,
      description:
        settlement.kind === "refund_due"
          ? `Rozdíl ${settlement.amount} Kč k vrácení — vraťte ho u objednávky jedním klikem.`
          : "Beze změny ceny, nebo se vyrovná při předání.",
      audience: "owner",
      email: true,
      resource: { id: order.id, type: "order" },
    }).catch(() => {})

    res.status(200).json({
      status: "confirmed",
      difference,
      refund_due: settlement.kind === "refund_due" ? settlement.amount : 0,
      message:
        settlement.kind === "refund_due"
          ? `Uloženo. Rozdíl ${settlement.amount} Kč vám vrátíme na kartu.`
          : "Uloženo.",
    })
  } catch (error) {
    await cancelBeginOrderEditWorkflow(req.scope)
      .run({ input: { order_id: order.id } as never })
      .catch(() => {})
    throw error
  }
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const order = await loadOwnOrder(req, req.params.id)
  await cancelBeginOrderEditWorkflow(req.scope)
    .run({ input: { order_id: order.id } as never })
    .catch(() => {})
  res.status(200).json({ cancelled: true })
}
