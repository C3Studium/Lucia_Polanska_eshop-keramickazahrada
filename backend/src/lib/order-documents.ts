import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { LEGAL_MANIFEST } from "./legal"
import { orderLegalInfo } from "./legal/order-legal"
import { getLegalFacts } from "./merchant-settings"
import { fetchGlazeProtocols, glazeProtocolsForOrder } from "./glaze-protocols"
import { balanceInvoiceStateOf, invoiceStateOf, storedCreditNotesOf } from "./idoklad-invoice"
import { buildOrderConfirmation } from "./potvrzeni-zakazky"
import { isCommissionCheckoutOrder } from "./potvrzeni-zakazky/fields"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

/**
 * Dokumenty objednávky ke stažení (19. 11. 2026, Matěj: „na stránce potvrzené
 * objednávky stáhnout fakturu a všechny další dokumenty, jako v e-mailu").
 *
 * Totéž, co dostane zákazník do e-mailů, na jednom místě:
 * - potvrzení objednávky (PDF smlouvy, § 1827 OZ) — u zakázky potvrzení
 *   zakázky po položkách,
 * - faktura (u zakázky zálohová a doplatková) a dobropisy z iDokladu,
 * - obchodní podmínky a poučení o odstoupení s formulářem — ve verzi, se
 *   kterou zákazník při objednávce souhlasil,
 * - protokol o nezávadnosti glazury, když ho výrobek v objednávce tvrdí.
 *
 * Jen dokumenty, které opravdu existují (s adresou PDF); faktura se objeví,
 * až ji iDoklad vystaví. Chyba jedné části nesmí shodit ostatní.
 */

export type OrderDocument = {
  key: string
  /** Česky — obchod je česky. */
  title: string
  /** Podtitulek (číslo faktury, verze podmínek…). */
  note: string | null
  url: string
  filename: string
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "metadata",
  "payment_collections.metadata",
  "items.id",
  "items.title",
  "items.product_title",
  "items.metadata",
  "items.product.description",
]

const safe = (value: unknown) => String(value ?? "").replace(/[^0-9A-Za-z_-]/g, "") || "doklad"

/** Adresa PDF potvrzení objednávky — uložená, jinak se vytvoří a uloží (starší objednávky). */
export const ensureOrderConfirmationPdf = async (
  container: MedusaContainer,
  order: any
): Promise<string | null> => {
  const meta = (order?.metadata ?? {}) as Record<string, unknown>
  if (typeof meta.confirmation_pdf_url === "string" && meta.confirmation_pdf_url) {
    return meta.confirmation_pdf_url
  }
  const built = await buildOrderConfirmation(container, order.id)
  await saveOrderConfirmationPdf(container, order.id, built)
  return built.url
}

/** Zapíše uložené PDF potvrzení do objednávky (klíče čte i `buildOrderConfirmation`). */
export const saveOrderConfirmationPdf = async (
  container: MedusaContainer,
  orderId: string,
  stored: { key: string; url: string; sha256: string }
): Promise<void> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "metadata"], filters: { id: orderId } })
  const metadata = ((data as any[])[0]?.metadata ?? {}) as Record<string, unknown>
  if (metadata.confirmation_pdf_url === stored.url && metadata.confirmation_pdf_sha256 === stored.sha256) return
  const orderModule: any = container.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    {
      id: orderId,
      metadata: {
        ...metadata,
        confirmation_pdf_key: stored.key,
        confirmation_pdf_url: stored.url,
        confirmation_pdf_sha256: stored.sha256,
      },
    },
  ])
}

export const orderDocuments = async (container: MedusaContainer, orderId: string): Promise<OrderDocument[]> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: orderId } })
  const order = (data as any[])[0]
  if (!order) return []
  const number = safe(order.display_id)
  const docs: OrderDocument[] = []
  const zkus = async (co: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (error) {
      logger.warn(`[dokumenty] #${order.display_id}: ${co} — ${error instanceof Error ? error.message : error}`)
    }
  }

  /* 1) Potvrzení objednávky / zakázky */
  let productionOrders: any[] = []
  await zkus("zakázky", async () => {
    const mto = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
    productionOrders = ((await mto.listProductionOrders({ order_id: order.id } as never)) as any[]) ?? []
  })
  const jeZakazka = isCommissionCheckoutOrder(order) || productionOrders.length > 0
  if (jeZakazka) {
    const nazevPolozky = (lineItemId: unknown) =>
      ((order.items ?? []) as any[]).find((item) => item.id === lineItemId)?.product_title ?? null
    productionOrders
      .filter((production) => typeof production?.confirmation_pdf_url === "string" && production.confirmation_pdf_url)
      .forEach((production, index, all) =>
        docs.push({
          key: `potvrzeni-zakazky-${production.id}`,
          title: "Potvrzení zakázky",
          note: all.length > 1 ? nazevPolozky(production.line_item_id) : null,
          url: production.confirmation_pdf_url,
          filename: `Potvrzeni-zakazky-${number}${all.length > 1 ? `-${index + 1}` : ""}.pdf`,
        })
      )
  } else {
    await zkus("potvrzení objednávky", async () => {
      const url = await ensureOrderConfirmationPdf(container, order)
      if (url) {
        docs.push({
          key: "potvrzeni-objednavky",
          title: "Potvrzení objednávky",
          note: "Kupní smlouva — co bylo sjednáno",
          url,
          filename: `Potvrzeni-objednavky-${number}.pdf`,
        })
      }
    })
  }

  /* 2) Faktury a dobropisy z iDokladu */
  const faktura = invoiceStateOf(order)
  if (faktura.pdf_url) {
    docs.push({
      key: "faktura",
      title: jeZakazka ? "Faktura — záloha" : "Faktura",
      note: faktura.invoice_number ? `č. ${faktura.invoice_number}` : null,
      url: faktura.pdf_url,
      filename: `faktura-${safe(faktura.invoice_number ?? number)}.pdf`,
    })
  }
  const doplatek = balanceInvoiceStateOf(order)
  if (doplatek?.pdf_url) {
    docs.push({
      key: "faktura-doplatek",
      title: "Faktura — doplatek",
      note: doplatek.invoice_number ? `č. ${doplatek.invoice_number}` : null,
      url: doplatek.pdf_url,
      filename: `faktura-${safe(doplatek.invoice_number ?? number + "-doplatek")}.pdf`,
    })
  }
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const dobropisy = storedCreditNotesOf(meta).filter((note) => note.pdf_url)
  dobropisy.forEach((note) =>
    docs.push({
      key: `dobropis-${note.id}`,
      title: "Opravný daňový doklad (dobropis)",
      note: note.number ? `č. ${note.number}` : null,
      url: note.pdf_url as string,
      filename: `dobropis-${safe(note.number)}.pdf`,
    })
  )
  if (!dobropisy.length && typeof meta.idoklad_credit_note_pdf_url === "string" && meta.idoklad_credit_note_pdf_url) {
    docs.push({
      key: "dobropis",
      title: "Opravný daňový doklad (dobropis)",
      note: typeof meta.idoklad_credit_note_number === "string" ? `č. ${meta.idoklad_credit_note_number}` : null,
      url: meta.idoklad_credit_note_pdf_url,
      filename: `dobropis-${safe(meta.idoklad_credit_note_number ?? number)}.pdf`,
    })
  }

  /* 3) Obchodní podmínky a odstoupení — verze z objednávky */
  await zkus("právní dokumenty", async () => {
    const live = await getLegalFacts(container)
    const { legal } = orderLegalInfo(order, LEGAL_MANIFEST, live.source === "settings" ? live.facts : null)
    for (const doc of [legal.terms, legal.withdrawal]) {
      if (!doc?.pdf_url) continue
      docs.push({
        key: doc.slug,
        title: doc.slug === "obchodni-podminky" ? "Obchodní podmínky" : "Poučení o odstoupení a formulář",
        note: `verze ze dne ${doc.version_label}`,
        url: doc.pdf_url,
        filename: `${doc.slug}-${doc.version}.pdf`,
      })
    }
  })

  /* 4) Protokol o nezávadnosti glazury */
  await zkus("protokol glazury", async () => {
    const glaze = glazeProtocolsForOrder(order, await fetchGlazeProtocols())
    glaze.documents.forEach((doc, index) =>
      docs.push({
        key: `protokol-glazury-${index + 1}`,
        title: "Protokol o nezávadnosti glazury",
        note: [doc.glaze, doc.laboratory].filter(Boolean).join(" · ") || null,
        url: doc.url,
        filename: glaze.attachments[index]?.filename ?? `protokol-glazury-${index + 1}.pdf`,
      })
    )
  })

  return docs
}
