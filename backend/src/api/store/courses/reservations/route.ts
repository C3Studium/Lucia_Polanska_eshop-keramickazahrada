import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../modules/course"
import { photoConsentLine } from "../../../../modules/course/legal"
import type CourseModuleService from "../../../../modules/course/service"
import { ensureCoursePaymentLink } from "../../../../lib/course-payment"
import {
  formatCourseDate,
  sendCourseReservationConfirmedEmail,
} from "../../../../lib/course-emails"
import { signCourseReservationToken } from "../../../../lib/course-reservation-link"
import { notifyMerchant } from "../../../../lib/notify"
import { buildReservationConsents, parseReservation } from "./schema"

/**
 * The public reservation create — the „Rezervovat" button on /kurzy.
 *
 * Validation happens twice on purpose: friendly Czech messages here, and the
 * authoritative checks (published + future term, capacity under a row lock,
 * server-side price) inside `CourseModuleService.reserveSeats`. A logged-in
 * customer is linked via the optional-auth middleware (`middlewares.ts`);
 * guests book with just their contact details.
 *
 * Abuse handling copies the contact form: a honeypot that answers success
 * without doing anything, and a small per-e-mail window so a runaway script
 * cannot fill a term with pending reservations.
 *
 * Souhlasy (`./schema.ts`): bez souhlasu s OP a bez potvrzeného poučení
 * o výjimce z odstoupení (§ 1837 písm. j) OZ) → 400 s českou hláškou. Uloží
 * se k rezervaci do `consents` i se serverovým časem.
 */

const WINDOW_MS = 10 * 60 * 1000
const WINDOW_LIMIT = 5
const recentByEmail = new Map<string, number[]>()

const withinLimit = (email: string, now: number) => {
  const hits = (recentByEmail.get(email) ?? []).filter(
    (stamp) => now - stamp < WINDOW_MS
  )
  if (hits.length >= WINDOW_LIMIT) {
    recentByEmail.set(email, hits)
    return false
  }
  hits.push(now)
  recentByEmail.set(email, hits)
  return true
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = parseReservation(req.body)
  if ("message" in parsed) {
    res.status(400).json({ message: parsed.message })
    return
  }

  const input = parsed.data

  if (input.website) {
    // A bot told it succeeded just goes away; a bot told it failed retries.
    res.status(201).json({ reservation_id: null })
    return
  }

  if (!withinLimit(input.email.toLocaleLowerCase(), Date.now())) {
    res.status(429).json({
      message:
        "Přišlo příliš mnoho rezervací krátce po sobě. Zkuste to prosím za chvíli.",
    })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const customerId = req.auth_context?.actor_id || null

  let reservation: any
  let term: any
  try {
    ;({ reservation, term } = await courseService.reserveSeats({
      term_id: input.term_id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      party_size: input.party_size,
      payment_method: input.payment_method,
      source: "web",
      customer_id: customerId,
      consents: buildReservationConsents(input),
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

  const token = signCourseReservationToken(reservation.id)

  if (input.payment_method === "online") {
    try {
      const link = await ensureCoursePaymentLink(req.scope, {
        reservation,
        term,
      })

      /*
       * Odpověď první, e-maily potom: zákazník čeká na přesměrování na bránu
       * a nesmí na něj čekat déle kvůli odeslání pošty.
       */
      res.status(201).json({
        reservation_id: reservation.id,
        token,
        payment_url: link.payment_url,
      })

      /*
       * „Místo držíme, platba se zpracovává."
       *
       * DŘÍV tu nebylo nic. Platba na místě dostala potvrzení hned, platba
       * kartou až po `payment.captured` — a ta událost přijde jen tehdy,
       * když ComGate zavolá naše oznámení. Když nezavolalo, zákazník
       * neslyšel 24 hodin nic a pak mu přišlo „platba nedorazila", i když
       * zaplatil. Tenhle e-mail je důkaz, že rezervace vznikla, a nese odkaz,
       * přes který se k platbě vrátí.
       *
       * Potvrzení platby přijde zvlášť (`subscribers/course-payment.ts`) —
       * jiný dedupe klíč, takže se nepřebijí.
       */
      await sendCourseReservationConfirmedEmail(req.scope, reservation, term, {
        variant: "awaiting_payment",
      }).catch(() => undefined)

      await notifyMerchant(req.scope, {
        key: `course-res:${reservation.id}`,
        title: `Kurzy: nová rezervace — ${reservation.name}`,
        description: [
          `${term.title} · ${formatCourseDate(term.starts_at)}`,
          `${reservation.party_size} os. · ${reservation.name} <${reservation.email}>${
            reservation.phone ? `, tel. ${reservation.phone}` : ""
          }`,
          "Platí kartou — čeká se na potvrzení platby.",
          photoConsentLine(reservation.consents),
        ].join("\n"),
        audience: "owner",
      }).catch(() => undefined)
      return
    } catch (error) {
      // The seats must not stay blocked by a reservation nobody can pay for —
      // cancel it so a retry starts clean. Reason-wise this is the system
      // acting on an unpayable booking, so it files under the same
      // „nezaplaceno (automaticky)" label the 24h expiry uses.
      await courseService
        .updateCourseReservations({
          id: reservation.id,
          status: "cancelled",
          cancelled_at: new Date(),
          cancel_reason: "auto_expired",
        } as never)
        .catch(() => undefined)
      req.scope
        .resolve("logger")
        .error(
          `[kurzy] Platbu rezervace ${reservation.id} se nepodařilo založit: ${
            error instanceof Error ? error.message : "neznámá chyba"
          }`
        )
      res.status(502).json({
        message:
          "Platbu se teď nepodařilo založit. Zkuste to prosím znovu, nebo zvolte platbu na místě.",
      })
      return
    }
  }

  // Pay on site: confirm right away.
  await sendCourseReservationConfirmedEmail(req.scope, reservation, term, {
    variant: "on_site",
  }).catch(() => undefined)

  await notifyMerchant(req.scope, {
    key: `course-res:${reservation.id}`,
    title: `Kurzy: nová rezervace — ${reservation.name}`,
    description: [
      `${term.title} · ${formatCourseDate(term.starts_at)}`,
      `${reservation.party_size} os. · ${reservation.name} <${reservation.email}>${
        reservation.phone ? `, tel. ${reservation.phone}` : ""
      }`,
      "Zaplatí na místě.",
      photoConsentLine(reservation.consents),
    ].join("\n"),
    audience: "owner",
    email: true,
  }).catch(() => undefined)

  res.status(201).json({ reservation_id: reservation.id, token })
}
