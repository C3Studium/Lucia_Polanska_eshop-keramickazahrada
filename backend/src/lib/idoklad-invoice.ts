import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IDOKLAD_MODULE } from "../modules/idoklad"
import type IdokladModuleService from "../modules/idoklad/service"
import {
  IDOKLAD_METADATA_KEYS,
  type IdokladInvoiceState,
} from "../modules/idoklad/types"
import {
  buildContactPayload,
  buildInvoicePayload,
  pickPaymentOptionId,
  pragueDate,
} from "../modules/idoklad/utils"
import {
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "./customer-email"
import { notifyMerchant } from "./notify"
import { epsilonFor, toAmount } from "./ship-gate"

/**
 * Invoicing an order in iDoklad (FINISHINGTODOLIST §1).
 *
 * ## The rules, in one place
 *
 * - An invoice is issued **once the order is fully paid** — a made-to-order
 *   deposit capture is not an invoice moment, the balance capture is.
 * - A **dobírka** order gets its invoice at handover to the carrier (unpaid),
 *   and is recorded as paid in iDoklad when the carrier's money is captured.
 * - Idempotency lives in `order.metadata.idoklad_*`: an existing
 *   `idoklad_invoice_id` means never issue again, `idoklad_invoice_paid_at`
 *   means never pay again. First writer wins; concurrent callers in this
 *   process additionally serialize through a per-order lock.
 * - When iDoklad is not configured (module not registered), every entry point
 *   logs and returns `skipped` — checkout and fulfilment never depend on it.
 *
 * The PDF is mirrored to our own file storage (MinIO) so the customer link
 * keeps working without iDoklad credentials, and the customer gets the
 * `invoice-issued` e-mail. Both of those are best-effort: a missing PDF or a
 * failed e-mail never rolls back an issued invoice.
 */

/** Composite provider id, mirrored in `storefront/src/lib/constants.tsx`. */
export const DOBIRKA_PROVIDER_ID = "pp_dobirka_ceska-posta"

export type IdokladActionResult = {
  status: "created" | "paid" | "exists" | "skipped" | "failed"
  /** Czech, safe to show in the admin. */
  reason?: string
  state?: IdokladInvoiceState
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "total",
  "shipping_total",
  "metadata",
  "items.title",
  "items.product_title",
  "items.quantity",
  "items.total",
  "shipping_methods.name",
  "billing_address.*",
  "shipping_address.*",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.payments.id",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
]

export const loadInvoiceOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<any | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (data[0] as any) ?? null
}

export const invoiceStateOf = (order: any): IdokladInvoiceState => {
  const metadata = (order?.metadata ?? {}) as Record<string, unknown>
  const numeric = Number(metadata[IDOKLAD_METADATA_KEYS.invoiceId])
  const text = (key: string): string | null => {
    const value = metadata[key]
    return typeof value === "string" && value.trim().length ? value : null
  }
  return {
    invoice_id: Number.isFinite(numeric) && numeric > 0 ? numeric : null,
    invoice_number: text(IDOKLAD_METADATA_KEYS.invoiceNumber),
    pdf_url: text(IDOKLAD_METADATA_KEYS.pdfUrl),
    issued_at: text(IDOKLAD_METADATA_KEYS.issuedAt),
    paid_at: text(IDOKLAD_METADATA_KEYS.paidAt),
    error: text(IDOKLAD_METADATA_KEYS.error),
  }
}

export const isDobirkaOrder = (order: any): boolean =>
  (order?.payment_collections ?? []).some((collection: any) =>
    (collection?.payments ?? []).some(
      (payment: any) => payment?.provider_id === DOBIRKA_PROVIDER_ID
    )
  )

/** Fully paid in the ship-gate sense: captured covers the total, to a haléř. */
export const isFullyCaptured = (order: any): boolean => {
  const captured = (order?.payment_collections ?? []).reduce(
    (sum: number, collection: any) => sum + toAmount(collection?.captured_amount),
    0
  )
  return captured >= toAmount(order?.total) - epsilonFor(order?.currency_code)
}

export const resolveIdokladService = (
  container: MedusaContainer
): IdokladModuleService | null => {
  try {
    return container.resolve<IdokladModuleService>(IDOKLAD_MODULE)
  } catch {
    return null
  }
}

/**
 * Event delivery is at-least-once and `shipment.created` can race
 * `payment.captured`, so in-process callers serialize per order. Cross-process
 * duplicates are caught by the metadata check re-done inside the lock.
 */
const orderLocks = new Map<string, Promise<unknown>>()

const withOrderLock = async <T>(
  orderId: string,
  fn: () => Promise<T>
): Promise<T> => {
  const previous = orderLocks.get(orderId) ?? Promise.resolve()
  const run = previous.then(fn, fn)
  const stored = run.then(
    () => undefined,
    () => undefined
  )
  orderLocks.set(orderId, stored)
  try {
    return await run
  } finally {
    if (orderLocks.get(orderId) === stored) {
      orderLocks.delete(orderId)
    }
  }
}

const patchOrderMetadata = async (
  container: MedusaContainer,
  order: any,
  patch: Record<string, unknown>
): Promise<void> => {
  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    {
      id: order.id,
      metadata: { ...((order.metadata ?? {}) as Record<string, unknown>), ...patch },
    },
  ] as never)
}

const describeError = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return String(error ?? "Neznámá chyba")
}

const reportFailure = async (
  container: MedusaContainer,
  order: any,
  action: "issue" | "pay",
  message: string
): Promise<void> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.error(
    `[idoklad] Objednávka #${order?.display_id ?? order?.id}: ${message}`
  )

  await patchOrderMetadata(container, order, {
    [IDOKLAD_METADATA_KEYS.error]: message,
  }).catch(() => undefined)

  // D7: a technical failure belongs to the developer's inbox, once per order
  // and action — a retry that fails again reuses the key and stays quiet.
  await notifyMerchant(container, {
    key: `idoklad-${action}:${order?.id}`,
    title:
      action === "issue"
        ? `iDoklad: fakturu k objednávce #${order?.display_id ?? "?"} se nepodařilo vystavit`
        : `iDoklad: úhradu faktury k objednávce #${order?.display_id ?? "?"} se nepodařilo zapsat`,
    description: message,
    audience: "dev",
    email: true,
    ...(order?.id ? { resource: { id: order.id, type: "order" } } : {}),
  }).catch(() => undefined)
}

/**
 * Mirrors the invoice PDF into our own storage and returns its URL, or `null`
 * when anything along the way fails — the invoice itself already exists and
 * must not be rolled back because of a PDF.
 */
const storeInvoicePdf = async (
  container: MedusaContainer,
  idoklad: IdokladModuleService,
  invoiceId: number,
  invoiceNumber: string
): Promise<string | null> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const pdf = await idoklad.getInvoicePdf(invoiceId)
    const fileModule = container.resolve(Modules.FILE)
    const [uploaded] = await fileModule.createFiles([
      {
        filename: `faktura-${invoiceNumber || invoiceId}.pdf`,
        mimeType: "application/pdf",
        // The provider does `Buffer.from(content, "binary")`, so it wants the
        // bytes as a binary string (same contract as made-to-order media).
        content: pdf.toString("binary"),
        access: "public" as const,
      },
    ])
    return uploaded?.url ?? null
  } catch (error) {
    logger.warn(
      `[idoklad] PDF faktury ${invoiceNumber || invoiceId} se nepodařilo uložit: ${describeError(error)}`
    )
    return null
  }
}

const sendInvoiceEmail = async (
  container: MedusaContainer,
  order: any,
  state: IdokladInvoiceState
): Promise<void> => {
  await sendCustomerEmail(container, {
    template: "invoice-issued",
    to: order.email,
    key: `invoice:${state.invoice_id}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      invoiceNumber: state.invoice_number ?? "",
      invoicePdfUrl: state.pdf_url ?? "",
      totalAmount: formatMoney(order.total, order.currency_code),
    },
  }).catch((error) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    logger.warn(
      `[idoklad] E-mail s fakturou ${state.invoice_number} se nepodařilo odeslat: ${describeError(error)}`
    )
  })
}

export type EnsureInvoiceOptions = {
  /** Where the request came from — only used for honest logging. */
  source: "payment" | "handover" | "admin"
  /**
   * When true, a not-fully-captured order is skipped. The payment subscriber
   * sets this so a made-to-order *deposit* capture never produces an invoice;
   * handover (dobírka) and the admin button do not gate on money.
   */
  requireFullyCaptured?: boolean
}

/**
 * Issues the iDoklad invoice for an order, exactly once.
 */
export const ensureInvoiceForOrder = async (
  container: MedusaContainer,
  orderId: string,
  options: EnsureInvoiceOptions
): Promise<IdokladActionResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const idoklad = resolveIdokladService(container)
  if (!idoklad) {
    logger.info(
      `[idoklad] Přeskakuji fakturu pro objednávku ${orderId} — IDOKLAD_CLIENT_ID/SECRET nejsou nastavené.`
    )
    return { status: "skipped", reason: "iDoklad není nakonfigurován." }
  }

  return withOrderLock(orderId, async () => {
    const order = await loadInvoiceOrder(container, orderId)
    if (!order) {
      return { status: "skipped", reason: "Objednávka nebyla nalezena." }
    }

    const state = invoiceStateOf(order)
    if (state.invoice_id) {
      return { status: "exists", state }
    }

    if (options.requireFullyCaptured && !isFullyCaptured(order)) {
      logger.info(
        `[idoklad] Objednávka #${order.display_id} zatím není plně uhrazena — faktura počká na doplatek.`
      )
      return { status: "skipped", reason: "Objednávka není plně uhrazena." }
    }

    try {
      // 1) The customer as a contact — reused by e-mail, created when new.
      const email = String(order.email ?? "").trim()
      let contact = email ? await idoklad.findContactByEmail(email) : null
      if (!contact) {
        const countryCode = (
          order.billing_address?.country_code ??
          order.shipping_address?.country_code ??
          "cz"
        ) as string
        const countryId = await idoklad
          .findCountryIdByCode(countryCode)
          .catch(() => undefined)
        contact = await idoklad.createContact(
          buildContactPayload(order, countryId)
        )
      }

      // 2) Agenda defaults + the payment option matching how the order pays.
      const defaults = await idoklad.getInvoiceDefault()
      const paymentOptions = await idoklad
        .listPaymentOptions()
        .catch(() => [])
      const paymentOptionId = pickPaymentOptionId(paymentOptions, {
        cod: isDobirkaOrder(order),
        defaultId: defaults.PaymentOptionId,
      })
      const currencyCode = String(order.currency_code ?? "czk").toUpperCase()
      const currencyId =
        currencyCode === "CZK"
          ? undefined
          : await idoklad.findCurrencyIdByCode(currencyCode).catch(() => undefined)

      // 3) Create, then stamp metadata immediately — the invoice id is the
      //    idempotency fact and must survive even if PDF or e-mail fail.
      const invoice = await idoklad.createInvoice(
        buildInvoicePayload({
          order,
          defaults,
          partnerId: contact.Id,
          vatPayer: idoklad.vatPayer,
          paymentOptionId,
          numericSequenceId: idoklad.numericSequenceId,
          currencyId,
        })
      )

      const issuedAt = new Date().toISOString()
      const stamped: Record<string, unknown> = {
        [IDOKLAD_METADATA_KEYS.invoiceId]: invoice.Id,
        [IDOKLAD_METADATA_KEYS.invoiceNumber]: invoice.DocumentNumber ?? "",
        [IDOKLAD_METADATA_KEYS.issuedAt]: issuedAt,
        [IDOKLAD_METADATA_KEYS.error]: null,
      }
      await patchOrderMetadata(container, order, stamped)
      order.metadata = {
        ...((order.metadata ?? {}) as Record<string, unknown>),
        ...stamped,
      }

      logger.info(
        `[idoklad] Faktura ${invoice.DocumentNumber} (${invoice.Id}) vystavena k objednávce #${order.display_id} [${options.source}].`
      )

      // 4) Best-effort tail: PDF to MinIO, e-mail to the customer.
      const pdfUrl = await storeInvoicePdf(
        container,
        idoklad,
        invoice.Id,
        invoice.DocumentNumber ?? String(invoice.Id)
      )
      if (pdfUrl) {
        await patchOrderMetadata(container, order, {
          [IDOKLAD_METADATA_KEYS.pdfUrl]: pdfUrl,
        })
      }

      const nextState: IdokladInvoiceState = {
        invoice_id: invoice.Id,
        invoice_number: invoice.DocumentNumber ?? null,
        pdf_url: pdfUrl,
        issued_at: issuedAt,
        paid_at: null,
        error: null,
      }

      await sendInvoiceEmail(container, order, nextState)

      return { status: "created", state: nextState }
    } catch (error) {
      const message = describeError(error)
      await reportFailure(container, order, "issue", message)
      return { status: "failed", reason: message }
    }
  })
}

/**
 * Records the order's invoice as fully paid in iDoklad, exactly once.
 * For dobírka this is the moment the carrier's money is recorded as captured.
 */
export const markInvoicePaidForOrder = async (
  container: MedusaContainer,
  orderId: string,
  paidAt?: string | Date | null
): Promise<IdokladActionResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const idoklad = resolveIdokladService(container)
  if (!idoklad) {
    return { status: "skipped", reason: "iDoklad není nakonfigurován." }
  }

  return withOrderLock(orderId, async () => {
    const order = await loadInvoiceOrder(container, orderId)
    if (!order) {
      return { status: "skipped", reason: "Objednávka nebyla nalezena." }
    }

    const state = invoiceStateOf(order)
    if (!state.invoice_id) {
      return {
        status: "skipped",
        reason: "Objednávka zatím nemá vystavenou fakturu.",
        state,
      }
    }
    if (state.paid_at) {
      return { status: "exists", state }
    }

    try {
      await idoklad.fullyPayInvoice(state.invoice_id, pragueDate(paidAt))

      const paidStamp = new Date().toISOString()
      await patchOrderMetadata(container, order, {
        [IDOKLAD_METADATA_KEYS.paidAt]: paidStamp,
        [IDOKLAD_METADATA_KEYS.error]: null,
      })

      logger.info(
        `[idoklad] Faktura ${state.invoice_number ?? state.invoice_id} k objednávce #${order.display_id} označena jako uhrazená.`
      )

      return { status: "paid", state: { ...state, paid_at: paidStamp, error: null } }
    } catch (error) {
      const message = `Úhrada: ${describeError(error)}`
      await reportFailure(container, order, "pay", message)
      return { status: "failed", reason: message }
    }
  })
}
