import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import {
  courseReminderCallListKey,
  reminderWindow,
} from "../modules/course/lifecycle"
import {
  formatCourseDate,
  sendCourseReminderEmail,
} from "../lib/course-emails"
import { notifyMerchant } from "../lib/notify"

/**
 * The three-days-before reminder (docs/kurzy-system.md).
 *
 * Every non-cancelled reservation on a published term starting in ~3 days
 * gets one e-mail with everything needed at the door: kde, kdy, kolik osob,
 * co s sebou (the term's note) and — for pay-on-site bookings — how much to
 * bring. Nobody is skipped for not having paid yet: people who pay at the
 * door are coming too, and the reminder is exactly the mail that tells them
 * what to bring.
 *
 * The window is now+2d…now+3d rather than an exact 72-hour line, so a job
 * that fires late still catches every term; the per-reservation dedupe key
 * (`course-reminder:{id}`) turns the day-to-day overlap into no-ops — one
 * reminder per reservation, ever.
 *
 * Manual phone bookings without an e-mail can't be reminded by us — so the
 * owner is, once per term (`course-reminder-calllist:{term_id}`): a morning
 * note listing whom to ring herself.
 */
export default async function courseReminders(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

  const { from, to } = reminderWindow(new Date())
  const terms = (await courseService.listCourseTerms(
    {
      status: "published",
      starts_at: { $gte: from, $lte: to },
    } as never,
    { relations: ["reservations"] } as never
  )) as any[]

  let sent = 0

  for (const term of terms) {
    const active = ((term.reservations ?? []) as any[]).filter(
      (reservation) => reservation.status !== "cancelled"
    )
    const withoutEmail: any[] = []

    for (const reservation of active) {
      if (!reservation.email) {
        withoutEmail.push(reservation)
        continue
      }
      const ok = await sendCourseReminderEmail(
        container,
        reservation,
        term
      ).catch((error) => {
        logger.error(
          `[kurzy] Připomínku rezervace ${reservation.id} se nepodařilo odeslat: ${
            error instanceof Error ? error.message : "neznámá chyba"
          }`
        )
        return false
      })
      if (ok) {
        sent += 1
      }
    }

    if (withoutEmail.length) {
      await notifyMerchant(container, {
        key: courseReminderCallListKey(term.id),
        title: `Kurzy: zavolejte účastníkům bez e-mailu — ${term.title}`,
        description: [
          `${term.title} · ${formatCourseDate(term.starts_at)} · ${term.location}`,
          `Tihle lidé nedostali připomínku, protože u nich není e-mail — prosím zavolejte jim:`,
          ...withoutEmail.map(
            (reservation) =>
              `· ${reservation.name} — ${reservation.party_size} os.${
                reservation.phone ? `, tel. ${reservation.phone}` : ""
              }`
          ),
        ].join("\n"),
        audience: "owner",
        email: true,
      }).catch((error) =>
        logger.error(
          `[kurzy] Seznam k obvolání pro termín ${term.id} se nepodařilo poslat: ${
            error instanceof Error ? error.message : "neznámá chyba"
          }`
        )
      )
    }
  }

  if (sent) {
    logger.info(`[kurzy] Odesláno ${sent} připomínek kurzu.`)
  }
}

export const config = {
  name: "course-reminders",
  // 07:30 — a morning send, after the 07:05 daily summary so the owner's
  // call-list note doesn't race the digest.
  schedule: "30 7 * * *",
}
