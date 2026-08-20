import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { toAmount } from "../../../../../modules/course/pricing"
import { signCourseReservationToken } from "../../../../../lib/course-reservation-link"

/**
 * The logged-in customer's course reservations, for the account dashboard.
 *
 * Lives under `/store/customers/me/*` so the framework's own customer auth
 * applies (the wishlist convention) — no custom middleware entry needed.
 *
 * Matched by `customer_id` **or** by the account's e-mail: a customer who
 * booked as a guest before registering still sees that booking, exactly like
 * a phone booking the owner typed in with their e-mail.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: customerId },
  })
  const email = (customers[0] as any)?.email?.trim().toLowerCase()

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const [byCustomer, byEmail] = await Promise.all([
    courseService.listCourseReservations(
      { customer_id: customerId } as never,
      { relations: ["term"] } as never
    ) as Promise<any[]>,
    email
      ? (courseService.listCourseReservations(
          { email } as never,
          { relations: ["term"] } as never
        ) as Promise<any[]>)
      : Promise.resolve([] as any[]),
  ])

  const byId = new Map<string, any>()
  for (const reservation of [...byCustomer, ...byEmail]) {
    byId.set(reservation.id, reservation)
  }

  const reservations = [...byId.values()]
    .filter((reservation) => reservation.term)
    .sort(
      (a, b) =>
        new Date(b.term.starts_at).getTime() -
        new Date(a.term.starts_at).getTime()
    )
    .map((reservation) => ({
      id: reservation.id,
      party_size: reservation.party_size,
      pricing_tier: reservation.pricing_tier,
      total_price: toAmount(reservation.total_price),
      payment_method: reservation.payment_method,
      payment_status: reservation.payment_status,
      status: reservation.status,
      created_at: reservation.created_at,
      invoice_pdf_url: reservation.idoklad_pdf_url ?? null,
      /** Signed link to the public reservation page (retry payment lives there). */
      token: signCourseReservationToken(reservation.id),
      term: {
        id: reservation.term.id,
        title: reservation.term.title,
        location: reservation.term.location,
        starts_at: reservation.term.starts_at,
        duration_minutes: reservation.term.duration_minutes ?? null,
        status: reservation.term.status,
      },
    }))

  res.json({ reservations })
}
