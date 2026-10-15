import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { formatMoney, sendCustomerEmail } from "./customer-email"
import { courseReservationLink } from "./course-reservation-link"
import { storefrontBase } from "./storefront-url"
import {
  formatVersionDate,
  LEGAL_MANIFEST,
  legalPdfFor,
  type LegalManifest,
} from "./legal"
import {
  checkAttachmentUrls,
  orderDocumentVersion,
  type EmailAttachmentRef,
} from "./legal/order-legal"
import {
  COURSE_CANCELLATION_TERMS,
  COURSE_NO_WITHDRAWAL_NOTICE,
  hasCourseCancellationTerms,
} from "../modules/course/legal"
import {
  courseCancelledKey,
  courseExpiredKey,
  courseReminderKey,
  courseWaitlistKey,
} from "../modules/course/lifecycle"

/**
 * The course e-mails, assembled in one place so the store route (pay on
 * site), the payment subscriber (paid online) and the admin cancel all send
 * the same shapes with the same dedupe keys.
 *
 * Times are formatted in Europe/Prague here, once — the database stores UTC
 * and no template should be doing timezone math.
 */

export const formatCourseDate = (value: unknown): string => {
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export const formatDuration = (minutes: unknown): string => {
  const value = Math.trunc(Number(minutes))
  if (!Number.isFinite(value) || value <= 0) {
    return ""
  }
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (!hours) {
    return `${rest} minut`
  }
  const hoursLabel = hours === 1 ? "hodina" : hours < 5 ? "hodiny" : "hodin"
  return rest ? `${hours} ${hoursLabel} ${rest} min` : `${hours} ${hoursLabel}`
}

const baseData = (reservation: any, term: any) => ({
  customerName: reservation.name || "Vážený zákazníku",
  courseTitle: term.title,
  courseDate: formatCourseDate(term.starts_at),
  courseLocation: term.location,
  courseDuration: formatDuration(term.duration_minutes),
  partySize: Number(reservation.party_size) || 1,
  totalAmount: formatMoney(reservation.total_price, "czk"),
  reservationLink: courseReservationLink(reservation.id),
})

/**
 * Obchodní podmínky, kapitola Kurzy — `app/[countryCode]/(main)/smluvni-podminky`,
 * kotva `#kurzy` (píše ji WS-A). Prázdné, když storefront není nastavený.
 */
export const courseTermsLink = (): string => {
  const base = storefrontBase()
  return base ? `${base}/smluvni-podminky#kurzy` : ""
}

export type CourseTermsInfo = {
  /** Verze OP, podle které se rezervace uzavřela (`YYYY-MM-DD`), nebo `null`. */
  version: string | null
  /** „15. 10. 2026", prázdné bez verze. */
  version_label: string
  /** Zveřejněné PDF té verze (absolutní https, ne pracovní znění), jinak `null`. */
  pdf_url: string | null
  /** Příloha e-mailu — jen u zveřejněného PDF. */
  attachment: EmailAttachmentRef | null
}

/**
 * Obchodní podmínky k rezervaci kurzu: verze ze souhlasu
 * (`consents.terms_version`), u rezervace bez souhlasu (ruční, starší) verze
 * platná v den rezervace — stejné pravidlo jako u objednávky
 * (`orderDocumentVersion`). PDF se přikládá jen zveřejněné: absolutní https
 * URL a ne pracovní znění s `[[DOPLNIT]]`.
 */
export const courseTermsInfo = (
  reservation: any,
  manifest: LegalManifest = LEGAL_MANIFEST
): CourseTermsInfo => {
  const consents = reservation?.consents ?? null
  const version = orderDocumentVersion(
    "obchodni-podminky",
    consents?.terms_version,
    consents?.accepted_at ?? reservation?.created_at ?? null,
    manifest
  )
  const pdf = version ? legalPdfFor("obchodni-podminky", version, manifest) : null
  const published = Boolean(pdf && !pdf.draft && /^https:\/\//i.test(pdf.url))
  return {
    version,
    version_label: version ? formatVersionDate(version) : "",
    pdf_url: published ? pdf!.url : null,
    attachment: published ? { filename: pdf!.filename, url: pdf!.url } : null,
  }
}

/**
 * The reservation confirmation — `variant: "paid"` after the ComGate webhook,
 * `variant: "on_site"` immediately for pay-on-site bookings. One template,
 * two voices; the paid variant doubles as the payment receipt, which is why
 * there is no separate course-payment-received template.
 *
 * Nese i poučení o výjimce z odstoupení (§ 1837 písm. j) OZ), storno
 * podmínky a PDF obchodních podmínek té verze, se kterou zákazník
 * rezervoval — potvrzení smlouvy o službě v textové podobě (§ 1827 odst. 2
 * OZ). Storno podmínky jen doplněné (`hasCourseCancellationTerms`); do té
 * doby šablona odkáže na OP čl. X. PDF jen zveřejněné a ke stažení (HEAD,
 * jako u objednávky) — jinak e-mail odejde s odkazem.
 */
export const sendCourseReservationConfirmedEmail = async (
  container: MedusaContainer,
  reservation: any,
  term: any,
  options: {
    variant: "paid" | "on_site"
    invoicePdfUrl?: string | null
    /**
     * A different dedupe key for re-sends with new content — the party-size
     * edit uses `courseConfirmUpdatedKey`, because the original key was
     * already delivered and would swallow the updated numbers.
     */
    keyOverride?: string
  }
): Promise<boolean> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const terms = courseTermsInfo(reservation)

  let attachments: EmailAttachmentRef[] = []
  if (terms.attachment) {
    const { reachable, failed } = await checkAttachmentUrls([terms.attachment])
    attachments = reachable
    for (const miss of failed) {
      logger.warn(
        `[kurzy] PDF ${miss.filename} (${miss.url}) není ke stažení (${miss.reason}) — ` +
          `potvrzení rezervace ${reservation.id} půjde s odkazem místo přílohy.`
      )
    }
  }

  return sendCustomerEmail(container, {
    template: "course-reservation-confirmed",
    to: reservation.email,
    key: options.keyOverride ?? `course-confirm:${options.variant}:${reservation.id}`,
    data: {
      ...baseData(reservation, term),
      variant: options.variant,
      invoicePdfUrl: options.invoicePdfUrl || "",
      noWithdrawalNotice: COURSE_NO_WITHDRAWAL_NOTICE,
      // Zástupný text do dat vůbec nejde — šablona pak odkáže na OP čl. X.
      cancellationTerms: hasCourseCancellationTerms() ? COURSE_CANCELLATION_TERMS : "",
      termsLink: courseTermsLink(),
      termsVersionLabel: terms.version_label,
      termsPdfUrl: terms.pdf_url ?? "",
      termsAttached: attachments.length > 0,
    },
    ...(attachments.length ? { attachments } : {}),
  })
}

/**
 * Sent to every affected booking when the owner cancels a whole term.
 * `refundedAutomatically` switches the money paragraph: true promises the
 * ComGate refund is already on its way, false keeps the manual-return promise
 * for the bookings whose automatic refund did not succeed.
 */
export const sendCourseTermCancelledEmail = async (
  container: MedusaContainer,
  reservation: any,
  term: any,
  options: { refundedAutomatically?: boolean } = {}
): Promise<boolean> =>
  sendCustomerEmail(container, {
    template: "course-term-cancelled",
    to: reservation.email,
    key: `course-term-cancelled:${term.id}:${reservation.id}`,
    data: {
      ...baseData(reservation, term),
      paidOnline:
        reservation.payment_method === "online" &&
        reservation.payment_status === "paid",
      refundedAutomatically: Boolean(options.refundedAutomatically),
    },
  })

/**
 * Sent when the owner cancels ONE reservation (term cancels have their own
 * fan-out above). The variant tells the money story: `refunded` — the
 * automatic ComGate refund already ran; `manual_refund` — paid but the
 * refund has to be returned by hand, the customer is promised a follow-up;
 * `unpaid` — nothing was paid, just the cancellation. Keyed per reservation,
 * so a retried cancel can never send it twice.
 */
export const sendCourseReservationCancelledEmail = async (
  container: MedusaContainer,
  reservation: any,
  term: any,
  options: {
    variant: "refunded" | "manual_refund" | "unpaid"
    /**
     * True when the customer cancelled it themselves — the template then
     * confirms *their* action („na vaši žádost") instead of announcing ours,
     * and drops the „kdyby šlo o nedorozumění" line that only makes sense
     * for a cancel they did not ask for.
     */
    cancelledByCustomer?: boolean
  }
): Promise<boolean> =>
  sendCustomerEmail(container, {
    template: "course-reservation-cancelled",
    to: reservation.email,
    key: courseCancelledKey(reservation.id),
    data: {
      ...baseData(reservation, term),
      variant: options.variant,
      cancelledByCustomer: Boolean(options.cancelledByCustomer),
    },
  })

/**
 * The 24h auto-expiry notice: the payment never arrived, the seats went back
 * on sale, and the button leads to the kurzy page for a fresh attempt. The
 * key is per reservation — a re-run of the hourly job cannot send it twice.
 */
export const sendCoursePaymentExpiredEmail = async (
  container: MedusaContainer,
  reservation: any,
  term: any
): Promise<boolean> =>
  sendCustomerEmail(container, {
    template: "course-payment-expired",
    to: reservation.email,
    key: courseExpiredKey(reservation.id),
    data: baseData(reservation, term),
  })

/**
 * The three-days-before reminder — once per reservation, ever. Pay-on-site
 * bookings are told how much to bring; paid ones just where and when.
 */
export const sendCourseReminderEmail = async (
  container: MedusaContainer,
  reservation: any,
  term: any
): Promise<boolean> =>
  sendCustomerEmail(container, {
    template: "course-reminder",
    to: reservation.email,
    key: courseReminderKey(reservation.id),
    data: {
      ...baseData(reservation, term),
      courseNote: term.note || "",
      payOnSiteAmount:
        reservation.payment_method === "on_site"
          ? formatMoney(reservation.total_price, "czk")
          : "",
    },
  })

/**
 * „Uvolnilo se místo" for a waitlist entry whose whole party now fits. The
 * entry's own id keys the send, so the seat-freeing hook can fire from any
 * number of places (cancel routes, expiry job, capacity increase) without
 * ever doubling the mail.
 */
export const sendCourseWaitlistSpotEmail = async (
  container: MedusaContainer,
  entry: any,
  term: any
): Promise<boolean> =>
  sendCustomerEmail(container, {
    template: "course-waitlist-spot",
    to: entry.email,
    key: courseWaitlistKey(entry.id),
    data: {
      customerName: entry.name || "Vážený zákazníku",
      courseTitle: term.title,
      courseDate: formatCourseDate(term.starts_at),
      courseLocation: term.location,
      partySize: Number(entry.party_size) || 1,
    },
  })
