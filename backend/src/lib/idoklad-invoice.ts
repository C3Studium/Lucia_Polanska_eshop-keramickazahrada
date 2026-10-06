import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getOrderDetailWorkflow } from "@medusajs/medusa/core-flows"
import { IDOKLAD_MODULE } from "../modules/idoklad"
import type IdokladModuleService from "../modules/idoklad/service"
import {
  IDOKLAD_BALANCE_METADATA_KEYS,
  IDOKLAD_METADATA_KEYS,
  type IdokladInvoiceState,
} from "../modules/idoklad/types"
import {
  buildContactPayload,
  buildInvoicePayload,
  pickPaymentOptionId,
  pragueDate,
  singleInvoiceLine,
} from "../modules/idoklad/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import {
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "./customer-email"
import { notifyMerchant } from "./notify"
import { jeZkusebniRezim } from "./test-mode"
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
  "items.*",
  "shipping_methods.*",
  "billing_address.*",
  "shipping_address.*",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.*",
  "payment_collections.payments.*",
]

/**
 * Loads the order THROUGH the detail workflow, not `query.graph`.
 *
 * The item and order totals are computed inside
 * `getOrderDetailWorkflow` — a plain graph read hands back rows without
 * them, which is how the first live invoice went out with zero-priced
 * lines and one huge „Zaokrouhlení". The workflow is the same source the
 * native order page and merchant-orders route read from, so the invoice
 * can never disagree with the screen she checked.
 */
export const loadInvoiceOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<any | null> => {
  try {
    const { result } = await getOrderDetailWorkflow(container).run({
      input: { order_id: orderId, fields: ORDER_FIELDS },
    })
    return (result as any) ?? null
  } catch {
    return null
  }
}

/**
 * The order's balné in CZK — recomputed the same way checkout priced it:
 * each line's `packaging_price` from product metadata × quantity (products
 * without one cost 0 to pack; the shop sets no global default). `null` when
 * the products cannot be read — the invoice then keeps shipping as one line
 * instead of inventing a split.
 */
export const packagingCzkFor = async (
  container: MedusaContainer,
  order: any
): Promise<number | null> => {
  try {
    const items = (order?.items ?? []) as any[]
    const productIds = [
      ...new Set(items.map((item) => item?.product_id).filter(Boolean)),
    ]
    if (!productIds.length) {
      return null
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      filters: { id: productIds },
    })
    const priceByProduct = new Map<string, number>()
    for (const product of products as any[]) {
      const raw = (product?.metadata as any)?.packaging_price
      const parsed = typeof raw === "number" ? raw : Number(raw)
      if (Number.isFinite(parsed) && parsed >= 0) {
        priceByProduct.set(product.id, parsed)
      }
    }
    const total = items.reduce((sum, item) => {
      const each = priceByProduct.get(item?.product_id) ?? 0
      const quantity = Number(toAmount(item?.quantity)) || 1
      return sum + each * quantity
    }, 0)
    return Math.round(total * 100) / 100
  } catch {
    return null
  }
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
        // The provider decodes `content` as base64 — the same contract Medusa's
        // own /admin/uploads route uses (and made-to-order media follows).
        content: pdf.toString("base64"),
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
      // Celý rozpis objednávky do faktury — stejný obsah jako potvrzení.
      order,
      invoiceKind: "full",
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

  /*
   * Zkušební režim — před vším ostatním.
   *
   * Číselná řada faktur je jednosměrná: vytržené číslo se nevrací a deset
   * zkušebních objednávek udělá deset děr, které pak někdo vysvětluje. Proto
   * se to zavírá dřív, než se sáhne na iDoklad, ne až uvnitř.
   *
   * Vrací se `skipped`, ne chyba: volající (odběratel na `payment.captured`,
   * tlačítko v administraci) mají faktury jako vedlejší efekt a nesmí je
   * shodit to, že se zrovna zkouší.
   */
  if (await jeZkusebniRezim(container)) {
    logger.info(
      `[idoklad] Přeskakuji fakturu pro objednávku ${orderId} — je zapnutý zkušební režim.`
    )
    return {
      status: "skipped",
      reason: "Zkušební režim — faktura se nevystavuje.",
    }
  }

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

      // The balné share, so the invoice can unfold shipping the way the
      // customer was told it: poštovné + balné.
      const packagingCzk = await packagingCzkFor(container, order)

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
          packagingCzk,
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
 * Faktury u ZAKÁZKY — záloha a doplatek zvlášť.
 *
 * Zakázka se platí na dvakrát (záloha hned, doplatek po dokončení) a na obě
 * platby je faktura POVINNÁ. Proto tu nejede jedna faktura na celek jako u
 * běžné objednávky, ale dvě jednořádkové: „Záloha k zakázce" (na zaplacenou
 * zálohu) a „Doplatek zakázky" (na zaplacený doplatek). Každá se vystaví, jakmile
 * je ta platba zaplacená, hned se v iDokladu označí jako uhrazená a pošle se
 * zákazníkovi. Idempotentní přes metadata (záloha = idoklad_invoice_*, doplatek
 * = idoklad_balance_invoice_*). Neplátce DPH → jeden řádek bez DPH.
 */
export const ensureMadeToOrderInvoices = async (
  container: MedusaContainer,
  orderId: string
): Promise<IdokladActionResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (await jeZkusebniRezim(container)) {
    return { status: "skipped", reason: "Zkušební režim — faktura se nevystavuje." }
  }
  const idoklad = resolveIdokladService(container)
  if (!idoklad) {
    return { status: "skipped", reason: "iDoklad není nakonfigurován." }
  }

  return withOrderLock(orderId, async () => {
    const order = await loadInvoiceOrder(container, orderId)
    if (!order) {
      return { status: "skipped", reason: "Objednávka nebyla nalezena." }
    }

    const mto = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
    const [productionOrder] = await mto.listProductionOrders({
      order_id: orderId,
    } as never)
    if (!productionOrder) {
      return { status: "skipped", reason: "Objednávka není zakázka." }
    }
    const requests = (await mto.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as never)) as any[]

    const round2 = (value: number) => Math.round(value * 100) / 100
    const paidDeposit = requests.find(
      (r) => r.type === "deposit" && r.status === "paid"
    )
    const paidBalance = requests.find(
      (r) => r.type === "balance" && r.status === "paid"
    )

    // Kontakt + výchozí agendu připravíme nejvýš jednou, a jen když opravdu
    // nějakou fakturu vystavujeme.
    let partnerId: number | null = null
    let defaults: any = null
    let paymentOptionId: number | undefined
    let currencyId: number | undefined
    const prepareBits = async () => {
      if (partnerId !== null) return
      const email = String(order.email ?? "").trim()
      let contact = email ? await idoklad.findContactByEmail(email) : null
      if (!contact) {
        const countryCode = (order.billing_address?.country_code ??
          order.shipping_address?.country_code ??
          "cz") as string
        const countryId = await idoklad
          .findCountryIdByCode(countryCode)
          .catch(() => undefined)
        contact = await idoklad.createContact(
          buildContactPayload(order, countryId)
        )
      }
      partnerId = contact.Id
      defaults = await idoklad.getInvoiceDefault()
      const paymentOptions = await idoklad.listPaymentOptions().catch(() => [])
      paymentOptionId = pickPaymentOptionId(paymentOptions, {
        cod: false,
        defaultId: defaults.PaymentOptionId,
      })
      const currencyCode = String(order.currency_code ?? "czk").toUpperCase()
      currencyId =
        currencyCode === "CZK"
          ? undefined
          : await idoklad
              .findCurrencyIdByCode(currencyCode)
              .catch(() => undefined)
    }

    const issuePhase = async (
      keys: {
        invoiceId: string
        invoiceNumber: string
        pdfUrl: string
        issuedAt: string
        paidAt: string
        error: string
      },
      amount: number,
      label: string,
      kind: "deposit" | "balance",
      balanceRemaining?: number,
      /** Příplatek, který je součástí TÉTO částky — na faktuře vlastní řádek. */
      surcharge?: number
    ): Promise<boolean> => {
      const already = Number(
        (order.metadata as Record<string, unknown> | undefined)?.[keys.invoiceId]
      )
      if (Number.isFinite(already) && already > 0) return false
      const rounded = round2(amount)
      if (rounded <= 0) return false

      // Příplatek jako SAMOSTATNÁ položka doplatku (ne schovaný v jedné sumě):
      // základ „Doplatek" + řádek „Příplatek". Součet dá přesně zaplacenou
      // částku (ořízneme příplatek stropem částky, ať se nikdy nerozejdou).
      const surchargeLine = round2(Math.min(Math.max(0, surcharge ?? 0), rounded))
      const baseLine = round2(rounded - surchargeLine)
      const items =
        surchargeLine > 0.005
          ? [
              ...(baseLine > 0.005
                ? [singleInvoiceLine(label, baseLine, idoklad.vatPayer)]
                : []),
              singleInvoiceLine(
                `Příplatek — zakázka č. ${order.display_id ?? order.id}`,
                surchargeLine,
                idoklad.vatPayer
              ),
            ]
          : [singleInvoiceLine(label, rounded, idoklad.vatPayer)]

      try {
        await prepareBits()
        const invoice = await idoklad.createInvoice(
          buildInvoicePayload({
            order,
            defaults,
            partnerId: partnerId!,
            vatPayer: idoklad.vatPayer,
            paymentOptionId,
            numericSequenceId: idoklad.numericSequenceId,
            currencyId,
            items,
            description: `${label} — obj. #${order.display_id ?? order.id}`,
          })
        )
        const issuedAt = new Date().toISOString()
        const stamp: Record<string, unknown> = {
          [keys.invoiceId]: invoice.Id,
          [keys.invoiceNumber]: invoice.DocumentNumber ?? "",
          [keys.issuedAt]: issuedAt,
          [keys.error]: null,
        }
        await patchOrderMetadata(container, order, stamp)
        order.metadata = {
          ...((order.metadata ?? {}) as Record<string, unknown>),
          ...stamp,
        }
        logger.info(
          `[idoklad] ${label} ${invoice.DocumentNumber} (${invoice.Id}) k zakázce #${order.display_id}.`
        )

        const pdfUrl = await storeInvoicePdf(
          container,
          idoklad,
          invoice.Id,
          invoice.DocumentNumber ?? String(invoice.Id)
        )
        if (pdfUrl) {
          await patchOrderMetadata(container, order, { [keys.pdfUrl]: pdfUrl })
          ;(order.metadata as Record<string, unknown>)[keys.pdfUrl] = pdfUrl
        }

        // Ta platba je zaplacená → faktura rovnou jako uhrazená.
        try {
          await idoklad.fullyPayInvoice(invoice.Id, pragueDate())
          const paidStamp = new Date().toISOString()
          await patchOrderMetadata(container, order, {
            [keys.paidAt]: paidStamp,
          })
          ;(order.metadata as Record<string, unknown>)[keys.paidAt] = paidStamp
        } catch (error) {
          logger.warn(
            `[idoklad] Úhradu faktury ${invoice.DocumentNumber} se nepodařilo zapsat: ${describeError(
              error
            )}`
          )
        }

        await sendCustomerEmail(container, {
          template: "invoice-issued",
          to: order.email,
          key: `invoice:${invoice.Id}`,
          orderId: order.id,
          data: {
            customerName: customerName(order),
            orderNumber: orderNumber(order),
            orderLink: orderLink(order),
            invoiceNumber: invoice.DocumentNumber ?? "",
            invoicePdfUrl: pdfUrl ?? "",
            totalAmount: formatMoney(rounded, order.currency_code),
            // Celý rozpis zakázky + (u zálohy) kolik ještě zbývá doplatit.
            order,
            invoiceKind: kind,
            balanceRemaining:
              kind === "deposit" &&
              typeof balanceRemaining === "number" &&
              balanceRemaining > 0
                ? formatMoney(balanceRemaining, order.currency_code)
                : undefined,
          },
        }).catch((error) =>
          logger.warn(
            `[idoklad] E-mail s fakturou ${invoice.DocumentNumber} se nepodařilo odeslat: ${describeError(
              error
            )}`
          )
        )
        return true
      } catch (error) {
        const message = describeError(error)
        await reportFailure(container, order, "issue", message)
        return false
      }
    }

    let created = false
    if (paidDeposit) {
      // Co po zaplacené záloze zbývá doplatit — z celku objednávky mínus záloha
      // (surcharge/doplatek upřesní její vlastní faktura později).
      const remaining = round2(
        toAmount(order.total) - toAmount(paidDeposit.amount)
      )
      created =
        (await issuePhase(
          IDOKLAD_METADATA_KEYS,
          toAmount(paidDeposit.amount),
          `Záloha k zakázce č. ${order.display_id ?? order.id}`,
          "deposit",
          remaining
        )) || created
    }
    if (paidBalance) {
      // Příplatek je celý v doplatku (záloha se počítá z původní ceny) → na
      // faktuře doplatku ho vyčleníme jako vlastní řádek.
      const surcharge = round2(toAmount(productionOrder.surcharge))
      created =
        (await issuePhase(
          IDOKLAD_BALANCE_METADATA_KEYS,
          toAmount(paidBalance.amount),
          `Doplatek zakázky č. ${order.display_id ?? order.id}`,
          "balance",
          undefined,
          surcharge
        )) || created
    }
    return { status: created ? "created" : "exists" }
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

  /* Zkušební režim: není co označovat zaplaceným, faktura nevznikla. */
  if (await jeZkusebniRezim(container)) {
    return {
      status: "skipped",
      reason: "Zkušební režim — faktura se nevystavuje.",
    }
  }

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

/**
 * Opravný daňový doklad (dobropis) při vrácení peněz — modul reklamací, fáze 2.
 *
 * Jen PLNÉ vrácení = plný dobropis na celou fakturu; částečné se nechá na ruční
 * vystavení (přesné položky), majitelku na to upozorníme. Best-effort a
 * idempotentní (metadata `idoklad_credit_note_id`): chyba vrácení peněz
 * neshodí, jen se zapíše a pošle vývojáři. Zkušební režim i nenastavený iDoklad
 * se přeskakují stejně jako u faktur.
 */
export const issueCreditNoteForOrder = async (
  container: MedusaContainer,
  order: any,
  opts: { amount: number }
): Promise<{
  status: "issued" | "skipped" | "exists" | "error"
  number?: string
  pdf_url?: string
  reason?: string
}> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (await jeZkusebniRezim(container)) {
    return { status: "skipped", reason: "Zkušební režim — dobropis se nevystavuje." }
  }
  const idoklad = resolveIdokladService(container)
  if (!idoklad) {
    return { status: "skipped", reason: "iDoklad není nakonfigurován." }
  }

  const metadata = (order.metadata ?? {}) as Record<string, any>
  if (metadata.idoklad_credit_note_id) {
    return {
      status: "exists",
      number: metadata.idoklad_credit_note_number ?? undefined,
      pdf_url: metadata.idoklad_credit_note_pdf_url ?? undefined,
    }
  }

  const state = invoiceStateOf(order)
  if (!state.invoice_id) {
    return {
      status: "skipped",
      reason: "K objednávce není faktura — dobropis nelze vystavit.",
    }
  }

  // Jen plné vrácení → plný dobropis. Částečné radši ručně, ať sedí položky.
  const full =
    opts.amount >= toAmount(order.total) - epsilonFor(order.currency_code)
  if (!full) {
    await notifyMerchant(container, {
      key: `idoklad-credit-partial:${order.id}`,
      title: `Dobropis k objednávce #${order.display_id} vystavte ručně`,
      description:
        "Vrácena jen část částky — opravný daňový doklad prosím vystavte v iDokladu podle skutečně vrácených položek.",
      audience: "owner",
      email: true,
      resource: { id: order.id, type: "order" },
    }).catch(() => undefined)
    return { status: "skipped", reason: "Částečné vrácení — dobropis ručně." }
  }

  return withOrderLock(order.id, async () => {
    try {
      const creditNote = (await idoklad.createCreditNoteForInvoice(
        state.invoice_id as number
      )) as any
      const creditId = Number(creditNote?.Id)
      const creditNumber =
        typeof creditNote?.DocumentNumber === "string" && creditNote.DocumentNumber
          ? creditNote.DocumentNumber
          : String(creditId)

      let pdfUrl: string | null = null
      try {
        const pdf = await idoklad.getCreditNotePdf(creditId)
        const fileModule = container.resolve(Modules.FILE)
        const [uploaded] = await fileModule.createFiles([
          {
            filename: `dobropis-${creditNumber}.pdf`,
            mimeType: "application/pdf",
            content: pdf.toString("base64"),
            access: "public" as const,
          },
        ])
        pdfUrl = uploaded?.url ?? null
      } catch (pdfError) {
        logger.warn(
          `[idoklad] PDF dobropisu ${creditNumber} se nepodařilo uložit: ${describeError(pdfError)}`
        )
      }

      await patchOrderMetadata(container, order, {
        idoklad_credit_note_id: creditId,
        idoklad_credit_note_number: creditNumber,
        idoklad_credit_note_pdf_url: pdfUrl,
        idoklad_credit_note_issued_at: new Date().toISOString(),
      })

      logger.info(
        `[idoklad] Dobropis ${creditNumber} k objednávce #${order.display_id} vystaven.`
      )
      return { status: "issued", number: creditNumber, pdf_url: pdfUrl ?? undefined }
    } catch (error) {
      const message = describeError(error)
      logger.error(
        `[idoklad] Dobropis k objednávce #${order.display_id} se nepodařilo vystavit: ${message}`
      )
      await notifyMerchant(container, {
        key: `idoklad-credit:${order.id}`,
        title: `iDoklad: dobropis k objednávce #${order.display_id} se nepodařilo vystavit`,
        description: message,
        audience: "dev",
        email: true,
        resource: { id: order.id, type: "order" },
      }).catch(() => undefined)
      return { status: "error", reason: message }
    }
  })
}
