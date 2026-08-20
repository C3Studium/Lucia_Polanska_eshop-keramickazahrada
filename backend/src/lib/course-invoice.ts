import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { toAmount } from "../modules/course/pricing"
import {
  ITEM_TYPE_NORMAL,
  PRICE_TYPE_WITH_VAT,
  type IdokladInvoiceItemPayload,
} from "../modules/idoklad/types"
import {
  pickPaymentOptionId,
  pragueDate,
  vatRateTypeFor,
} from "../modules/idoklad/utils"
import { resolveIdokladService } from "./idoklad-invoice"
import { notifyMerchant } from "./notify"

/**
 * Invoicing a paid online course reservation, the way orders are invoiced.
 *
 * Reuses the iDoklad module service directly (contact lookup, agenda
 * defaults, invoice + PDF + payment) but not `ensureInvoiceForOrder` — that
 * helper is order-shaped through and through: it loads the order via the order
 * detail workflow and stores its idempotency facts in `order.metadata`. A
 * reservation has no order, so the same facts live on the reservation row
 * (`idoklad_invoice_id` & friends) and the line items are simply the course.
 *
 * Same guarantees as the order path:
 * - **Env-gated**: no iDoklad credentials → logged no-op, nothing depends on it.
 * - **Idempotent**: an existing `idoklad_invoice_id` is never issued again.
 * - **Best-effort tail**: a failed PDF mirror or e-mail never rolls back an
 *   issued invoice; a failure notifies the developer once (D7 pattern).
 * - **Neplátce DPH**: `vatRateTypeFor(idoklad.vatPayer)` — zero VAT unless the
 *   agenda is ever switched to a VAT payer via `IDOKLAD_VAT_PAYER`.
 */

const formatPragueDate = (value: unknown): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value as string))

const describeError = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : String(error ?? "Neznámá chyba")

export type CourseInvoiceResult = {
  status: "created" | "exists" | "skipped" | "failed"
  invoice_number?: string | null
  pdf_url?: string | null
  reason?: string
}

/**
 * Issues (and immediately marks paid) the iDoklad invoice for a paid online
 * reservation, exactly once. Returns what happened so callers can log
 * honestly and the confirmation e-mail can include the PDF link when it
 * already exists.
 */
export const ensureInvoiceForCourseReservation = async (
  container: MedusaContainer,
  reservation: any,
  term: any
): Promise<CourseInvoiceResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const idoklad = resolveIdokladService(container)
  if (!idoklad) {
    logger.info(
      `[idoklad] Přeskakuji fakturu k rezervaci kurzu ${reservation.id} — IDOKLAD_CLIENT_ID/SECRET nejsou nastavené.`
    )
    return { status: "skipped", reason: "iDoklad není nakonfigurován." }
  }

  if (reservation.idoklad_invoice_id) {
    return {
      status: "exists",
      invoice_number: reservation.idoklad_invoice_number ?? null,
      pdf_url: reservation.idoklad_pdf_url ?? null,
    }
  }

  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

  try {
    // 1) The customer as a contact — reused by e-mail, created when new.
    const email = String(reservation.email ?? "").trim()
    let contact = email ? await idoklad.findContactByEmail(email) : null
    if (!contact) {
      const countryId = await idoklad
        .findCountryIdByCode("cz")
        .catch(() => undefined)
      contact = await idoklad.createContact({
        CompanyName: String(reservation.name || "Zákazník kurzu").slice(0, 200),
        ...(email ? { Email: email.slice(0, 254) } : {}),
        ...(reservation.phone
          ? { Mobile: String(reservation.phone).slice(0, 20) }
          : {}),
        ...(countryId ? { CountryId: countryId } : {}),
      })
    }

    // 2) Agenda defaults + the card payment option (an online payment).
    const defaults = await idoklad.getInvoiceDefault()
    const paymentOptions = await idoklad.listPaymentOptions().catch(() => [])
    const paymentOptionId = pickPaymentOptionId(paymentOptions, {
      cod: false,
      defaultId: defaults.PaymentOptionId,
    })

    // One line, Amount 1 — it always sums to exactly what the customer paid,
    // with no per-person rounding drift to absorb.
    const total = toAmount(reservation.total_price)
    const item: IdokladInvoiceItemPayload = {
      Name: `${term.title} — ${formatPragueDate(term.starts_at)}, ${reservation.party_size} os.`.slice(
        0,
        200
      ),
      Amount: 1,
      UnitPrice: total,
      PriceType: PRICE_TYPE_WITH_VAT,
      VatRateType: vatRateTypeFor(idoklad.vatPayer),
      IsTaxMovement: false,
      DiscountPercentage: 0,
      ItemType: ITEM_TYPE_NORMAL,
    }

    const today = pragueDate()
    const invoice = await idoklad.createInvoice({
      CurrencyId: defaults.CurrencyId,
      DateOfIssue: today,
      DateOfTaxing: today,
      DateOfMaturity: defaults.DateOfMaturity || today,
      Description: `Rezervace kurzu — ${term.title}`,
      DocumentSerialNumber: defaults.DocumentSerialNumber,
      IsEet: false,
      IsIncomeTax: defaults.IsIncomeTax ?? true,
      Items: [item],
      NumericSequenceId: idoklad.numericSequenceId ?? defaults.NumericSequenceId,
      PartnerId: contact.Id,
      PaymentOptionId: paymentOptionId ?? defaults.PaymentOptionId,
      Note: "Vystaveno automaticky e-shopem Keramická zahrada.",
    })

    // 3) Stamp the idempotency facts immediately — the invoice id must
    //    survive even if the PDF mirror below fails.
    await courseService.updateCourseReservations({
      id: reservation.id,
      idoklad_invoice_id: invoice.Id,
      idoklad_invoice_number: invoice.DocumentNumber ?? null,
    } as never)

    logger.info(
      `[idoklad] Faktura ${invoice.DocumentNumber} (${invoice.Id}) vystavena k rezervaci kurzu ${reservation.id}.`
    )

    // 4) Record the payment — the reservation is only invoiced once paid.
    await idoklad
      .fullyPayInvoice(invoice.Id, pragueDate(reservation.paid_at))
      .catch((error) => {
        logger.warn(
          `[idoklad] Úhradu faktury ${invoice.DocumentNumber} k rezervaci ${reservation.id} se nepodařilo zapsat: ${describeError(error)}`
        )
      })

    // 5) Best-effort: mirror the PDF into our own storage so the customer
    //    link keeps working without iDoklad credentials.
    let pdfUrl: string | null = null
    try {
      const pdf = await idoklad.getInvoicePdf(invoice.Id)
      const fileModule = container.resolve(Modules.FILE)
      const [uploaded] = await fileModule.createFiles([
        {
          filename: `faktura-${invoice.DocumentNumber || invoice.Id}.pdf`,
          mimeType: "application/pdf",
          content: pdf.toString("base64"),
          access: "public" as const,
        },
      ])
      pdfUrl = uploaded?.url ?? null
      if (pdfUrl) {
        await courseService.updateCourseReservations({
          id: reservation.id,
          idoklad_pdf_url: pdfUrl,
        } as never)
      }
    } catch (error) {
      logger.warn(
        `[idoklad] PDF faktury ${invoice.DocumentNumber} k rezervaci ${reservation.id} se nepodařilo uložit: ${describeError(error)}`
      )
    }

    return {
      status: "created",
      invoice_number: invoice.DocumentNumber ?? null,
      pdf_url: pdfUrl,
    }
  } catch (error) {
    const message = describeError(error)
    logger.error(
      `[idoklad] Fakturu k rezervaci kurzu ${reservation.id} se nepodařilo vystavit: ${message}`
    )
    // Once per reservation — a retry that fails again reuses the key.
    await notifyMerchant(container, {
      key: `idoklad-course:${reservation.id}`,
      title: "iDoklad: fakturu k rezervaci kurzu se nepodařilo vystavit",
      description: `${reservation.name} — ${term.title}: ${message}`,
      audience: "dev",
      email: true,
    }).catch(() => undefined)
    return { status: "failed", reason: message }
  }
}
