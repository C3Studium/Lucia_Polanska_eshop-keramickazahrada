import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { verifyCourseReservationToken } from "../../../../../lib/course-reservation-link"

/**
 * Access resolution for the customer self-service routes (cancel, edit).
 *
 * Two proofs open a reservation, and either one suffices:
 *
 * 1. The signed HMAC token — the same one the status GET and the pay retry
 *    accept. E-mail links, the ComGate return page and the account list (its
 *    `/store/customers/me/course-reservations` response server-composes the
 *    token) all arrive holding it.
 * 2. A logged-in customer whose account owns the reservation — matched by
 *    `customer_id` or, for guest bookings made before registering, by the
 *    account's e-mail. The exact matching rule of the account list, so
 *    anything a customer can *see* in their account they can also act on.
 *
 * No proof → `null`, and the route answers 404 — indistinguishable from a
 * reservation that does not exist, so ids alone reveal nothing (the GET's
 * own behaviour).
 */
export const loadReservationForSelfService = async (
  req: MedusaRequest | AuthenticatedMedusaRequest,
  reservationId: string
): Promise<any | null> => {
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const reservations = (await courseService.listCourseReservations(
    { id: reservationId } as never,
    { relations: ["term"] } as never
  )) as any[]
  const reservation = reservations[0]

  if (!reservation || !reservation.term) {
    return null
  }

  if (verifyCourseReservationToken(reservationId, req.query.token)) {
    return reservation
  }

  const customerId = (req as AuthenticatedMedusaRequest).auth_context?.actor_id
  if (!customerId) {
    return null
  }
  if (reservation.customer_id === customerId) {
    return reservation
  }

  // Guest booking, later matched by the account's e-mail (stored lowercased).
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: customerId },
  })
  const email = (customers[0] as any)?.email?.trim().toLowerCase()
  if (email && reservation.email === email) {
    return reservation
  }

  return null
}
