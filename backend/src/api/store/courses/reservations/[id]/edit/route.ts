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
import {
  cancelPendingSupplements,
  previewCoursePartyChange,
  settleCoursePartyChange,
  startCourseSupplement,
  type PartyChangeOutcome,
} from "../../../../../../lib/course-party-change"
import { syncCourseMoney } from "../../../../../../lib/course-money"
import { notifyMerchant } from "../../../../../../lib/notify"

/**
 * „Změnit počet osob" — the customer edits their own party size.
 *
 * Access is the token OR the logged-in owner (see `../self-service.ts`).
 * Allowed until the same 24h cutoff as the cancel, and ONLY while nothing was
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
    // the lock and re-sending mail for a no-op. Návrat na původní počet ruší
    // i rozpracovanou změnu (čekající doplatek).
    await cancelPendingSupplements(req.scope, reservation.id).catch(() => undefined)
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

  /*
   * Přidání osob u ZAPLACENÉ rezervace = jako pokladna: změna platí, až doplatek
   * projde (lib/course-party-change `startCourseSupplement` →
   * `applyPaidCourseChange`). Rezervace se teď nemění — zrušená platba nebo
   * „Zrušit změnu" ji nechá, jak byla. Ubrání osob se provede hned (vrácení).
   */
  const preview = await previewCoursePartyChange(req.scope, { reservation, term, partySize })
  if (!preview.seats_ok) {
    res.status(400).json({ message: preview.message ?? "Tolik míst na termínu není." })
    return
  }
  if (preview.action === "supplement") {
    try {
      const link = await startCourseSupplement(req.scope, { reservation, term, preview })
      if (reservation.email) {
        await sendCourseReservationConfirmedEmail(
          req.scope,
          {
            ...reservation,
            party_size: preview.party_size,
            total_price: preview.total_price,
            paid_amount: preview.paid_amount,
            amount_due: preview.amount,
          },
          term,
          {
            variant: "paid",
            keyOverride: `course-change-pending:${link.request_id}`,
            change: { action: "supplement", amount: preview.amount },
          }
        ).catch(() => undefined)
      }
      res.json({
        ok: true,
        reservation: {
          id: reservation.id,
          party_size: Math.trunc(toAmount(reservation.party_size)),
          pricing_tier: reservation.pricing_tier,
          total_price: toAmount(reservation.total_price),
          paid_amount: toAmount(reservation.paid_amount),
          amount_due: toAmount(reservation.amount_due),
        },
        pending_change: { party_size: preview.party_size, total_price: preview.total_price, amount: preview.amount },
        change: { action: "supplement", amount: preview.amount },
        payment_url: link.payment_url,
      })
    } catch (error) {
      req.scope.resolve("logger").error(
        `[kurzy] Doplatek k rezervaci ${reservation.id} se nepodařilo založit: ${error instanceof Error ? error.message : error}`
      )
      res.status(502).json({ message: "Platbu doplatku se teď nepodařilo založit. Zkuste to prosím za chvíli." })
    }
    return
  }

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

  /*
   * Peníze po přepočtu ceny (lib/course-party-change, vzor zakázky):
   * zaplacená online rezervace → doplatek novou platbou, nebo vrácení rozdílu;
   * na místě / nezaplacená online → nová cena platí sama.
   */
  let outcome: PartyChangeOutcome = { action: "none" }
  try {
    outcome = await settleCoursePartyChange(req.scope, { reservationId: reservation.id, term })
  } catch (error) {
    req.scope
      .resolve("logger")
      .error(
        `[kurzy] Úprava rezervace ${reservation.id}: rozdíl se nepodařilo vyřídit: ${
          error instanceof Error ? error.message : error
        }`
      )
  }
  const money = (await syncCourseMoney(req.scope, reservation.id)) ?? { paid_amount: 0, amount_due: 0 }
  const fresh = { ...updated, ...money }

  if (reservation.email) {
    await sendCourseReservationConfirmedEmail(req.scope, fresh, term, {
      variant:
        reservation.payment_method === "on_site" ? "on_site" : money.paid_amount > 0 ? "paid" : "awaiting_payment",
      keyOverride: courseConfirmUpdatedKey(reservation.id, partySize),
      change: outcome.action === "none" ? undefined : outcome,
    }).catch(() => undefined)
  }
  await notifyMerchant(req.scope, {
    key: `course-edit:${reservation.id}:${partySize}:${Date.now()}`,
    title: `Kurzy: změna počtu osob — ${reservation.name}`,
    description: [
      `${term.title}: ${Math.trunc(toAmount(reservation.party_size))} → ${partySize} os., cena ${toAmount(updated.total_price)} Kč.`,
      outcome.action === "supplement"
        ? `Doplatek ${outcome.amount} Kč — zákazník platí kartou.`
        : outcome.action === "refund"
          ? outcome.refunded
            ? `Vráceno ${outcome.amount} Kč přes ComGate.`
            : `Vrátit ${outcome.amount} Kč — automaticky se nepovedlo, vraťte ručně.`
          : "Bez platby (na místě / ještě nezaplaceno).",
    ].join("\n"),
    audience: "owner",
  }).catch(() => undefined)

  res.json({
    ok: true,
    reservation: {
      id: updated.id,
      party_size: Math.trunc(toAmount(updated.party_size)),
      pricing_tier: updated.pricing_tier,
      total_price: toAmount(updated.total_price),
      paid_amount: money.paid_amount,
      amount_due: money.amount_due,
    },
    change: outcome,
    ...(outcome.action === "supplement" ? { payment_url: outcome.payment_url } : {}),
  })
}
