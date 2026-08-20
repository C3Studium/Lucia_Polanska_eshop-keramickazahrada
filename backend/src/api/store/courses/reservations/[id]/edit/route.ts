import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import {
  COURSE_SELF_SERVICE_TOO_LATE,
  canCustomerEditParty,
  courseConfirmUpdatedKey,
  isBeforeSelfServiceCutoff,
} from "../../../../../../modules/course/lifecycle"
import { toAmount } from "../../../../../../modules/course/pricing"
import { sendCourseReservationConfirmedEmail } from "../../../../../../lib/course-emails"
import { loadReservationForSelfService } from "../self-service"

/**
 * „Změnit počet osob" — the customer edits their own party size.
 *
 * Access is the token OR the logged-in owner (see `../self-service.ts`).
 * Allowed until the same 48h cutoff as the cancel, and ONLY while nothing was
 * paid online: a captured card payment fixes the amount, so paid reservations
 * are told to cancel (auto-refund) and re-book instead.
 *
 * The capacity re-check and the price recompute happen inside
 * `updateReservationPartySize` under the term's row lock — the same
 * arbitration as the reservation create, so a simultaneous booking cannot
 * overbook the term through this door either. A pending online payment link
 * is cleared there too (it carried the old amount); the next „Zaplatit"
 * mints a fresh one at the new price.
 *
 * Pay-on-site reservations get their confirmation re-sent with the new
 * numbers, keyed per size so a repeat edit re-sends and a retried request
 * does not. Online-unpaid ones do not — their authoritative confirmation is
 * the paid receipt, which arrives after payment with the new numbers anyway.
 */

const EditSchema = z.object({
  party_size: z.number().int().min(1).max(30),
})

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const parsed = EditSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Zadejte prosím počet osob od 1 do 30." })
    return
  }
  const partySize = parsed.data.party_size

  const reservation = await loadReservationForSelfService(req, req.params.id)

  if (!reservation) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  if (reservation.status === "cancelled") {
    res.status(400).json({ message: "Zrušenou rezervaci už nelze upravit." })
    return
  }
  const term = reservation.term
  if (term.status !== "published") {
    res.status(400).json({ message: "Tento termín už není možné upravit." })
    return
  }
  if (!isBeforeSelfServiceCutoff(term.starts_at, new Date())) {
    res.status(400).json({ message: COURSE_SELF_SERVICE_TOO_LATE })
    return
  }
  if (!canCustomerEditParty(reservation)) {
    res.status(400).json({
      message:
        "Zaplacenou rezervaci upravíte zrušením (peníze vrátíme na kartu) a novou rezervací — nebo mi zavolejte.",
    })
    return
  }

  if (Math.trunc(toAmount(reservation.party_size)) === partySize) {
    // Nothing changes — answer with the current state instead of re-running
    // the lock and re-sending mail for a no-op.
    res.json({
      ok: true,
      reservation: {
        id: reservation.id,
        party_size: partySize,
        pricing_tier: reservation.pricing_tier,
        total_price: toAmount(reservation.total_price),
      },
    })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  let updated: any
  try {
    ;({ reservation: updated } =
      await courseService.updateReservationPartySize({
        reservation_id: reservation.id,
        party_size: partySize,
      }))
  } catch (error) {
    if (error instanceof MedusaError) {
      res
        .status(error.type === MedusaError.Types.NOT_FOUND ? 404 : 400)
        .json({ message: error.message })
      return
    }
    throw error
  }

  if (reservation.email && reservation.payment_method === "on_site") {
    await sendCourseReservationConfirmedEmail(req.scope, updated, term, {
      variant: "on_site",
      keyOverride: courseConfirmUpdatedKey(reservation.id, partySize),
    }).catch(() => undefined)
  }

  res.json({
    ok: true,
    reservation: {
      id: updated.id,
      party_size: Math.trunc(toAmount(updated.party_size)),
      pricing_tier: updated.pricing_tier,
      total_price: toAmount(updated.total_price),
    },
  })
}
