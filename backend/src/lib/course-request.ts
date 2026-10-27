import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { quoteFor, toAmount } from "../modules/course/pricing"
import { formatMoney, sendCustomerEmail } from "./customer-email"
import { formatCourseDate } from "./course-emails"
import { courseReservationLink } from "./course-reservation-link"

/**
 * Žádost o místo na plně obsazeném termínu (`course_waitlist`).
 *
 * Zákazník pošle žádost (nic neplatí) → majitelka v administraci (Kurzy →
 * Žádosti o místo) zavolá nebo rovnou rozhodne:
 * - schválit = VÝJIMKA NAD KAPACITU: vznikne rezervace s cenou podle počtu
 *   osob, online s `payment_choice_pending` — zákazník si v ní vybere platbu
 *   (kartou / na místě) a potvrdí obchodní podmínky (`POST …/confirm`). Místo
 *   drží 24 h jako každá online rezervace (`expire-course-payments`).
 * - zamítnout = omluvný e-mail, případně se vzkazem.
 */

type Variant = "received" | "approved" | "denied"

const SUBJECTS: Record<Variant, (title: string) => string> = {
  received: (title) => `Žádost o místo na kurzu ${title} mám — ozvu se vám`,
  approved: (title) => `Místo na kurzu ${title} pro vás mám — potvrďte rezervaci`,
  denied: (title) => `Kurz ${title} — místo vám bohužel nabídnout nemohu`,
}

export const sendCourseRequestEmail = async (
  container: MedusaContainer,
  entry: any,
  term: any,
  variant: Variant,
  extra: { reservation?: any; decisionNote?: string | null } = {}
) =>
  sendCustomerEmail(container, {
    template: "course-request",
    to: entry.email,
    key: `course-request:${variant}:${entry.id}`,
    data: {
      subject: SUBJECTS[variant](term.title),
      variant,
      customerName: entry.name || "Vážený zákazníku",
      courseTitle: term.title,
      courseDate: formatCourseDate(term.starts_at),
      courseLocation: term.location,
      partySize: Math.trunc(toAmount(entry.party_size)) || 1,
      totalAmount: extra.reservation ? formatMoney(extra.reservation.total_price, "czk") : "",
      reservationLink: extra.reservation ? courseReservationLink(extra.reservation.id) : "",
      decisionNote: extra.decisionNote?.trim() || "",
    },
  })

const loadRequest = async (container: MedusaContainer, requestId: string) => {
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const [entry] = (await courseService.listCourseWaitlists(
    { id: requestId } as never,
    { relations: ["term"] } as never
  )) as any[]
  if (!entry || !entry.term) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Žádost nebyla nalezena.")
  }
  if (entry.status && entry.status !== "waiting") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "O žádosti už je rozhodnuto.")
  }
  return { courseService, entry, term: entry.term }
}

/** Schválit výjimku: rezervace nad kapacitu, zákazník si vybere platbu. */
export const approveCourseRequest = async (
  container: MedusaContainer,
  requestId: string,
  decisionNote?: string | null
) => {
  const { courseService, entry, term } = await loadRequest(container, requestId)
  if (term.status !== "published" || new Date(term.starts_at).getTime() <= Date.now()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Termín už není v nabídce nebo proběhl.")
  }
  const partySize = Math.max(1, Math.trunc(toAmount(entry.party_size)))
  const quote = quoteFor(partySize, term)

  // Schválně BEZ kontroly kapacity — o výjimce rozhodla majitelka.
  const reservation = (await courseService.createCourseReservations({
    term_id: term.id,
    customer_id: null,
    name: entry.name,
    email: String(entry.email).toLowerCase(),
    phone: entry.phone || null,
    party_size: partySize,
    pricing_tier: quote.tier,
    total_price: quote.total,
    payment_method: "online",
    payment_status: "pending",
    payment_choice_pending: true,
    paid_amount: 0,
    amount_due: quote.total,
    status: "active",
    source: "manual",
    note: [entry.note ? `Žádost: ${entry.note}` : "", "Výjimka nad kapacitu (schválená žádost)."]
      .filter(Boolean)
      .join(" "),
  } as never)) as any

  await courseService.updateCourseWaitlists({
    id: entry.id,
    status: "approved",
    decided_at: new Date(),
    decision_note: decisionNote?.trim() || null,
    reservation_id: reservation.id,
  } as never)

  await sendCourseRequestEmail(container, entry, term, "approved", { reservation, decisionNote }).catch(() => undefined)
  return { entry: { ...entry, status: "approved", reservation_id: reservation.id }, reservation }
}

/** Zamítnout: omluvný e-mail, případně se vzkazem. */
export const denyCourseRequest = async (
  container: MedusaContainer,
  requestId: string,
  decisionNote?: string | null
) => {
  const { courseService, entry, term } = await loadRequest(container, requestId)
  await courseService.updateCourseWaitlists({
    id: entry.id,
    status: "denied",
    decided_at: new Date(),
    decision_note: decisionNote?.trim() || null,
  } as never)
  await sendCourseRequestEmail(container, entry, term, "denied", { decisionNote }).catch(() => undefined)
  return { entry: { ...entry, status: "denied" } }
}
