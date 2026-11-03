import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { formatCourseDate, formatDuration } from "../lib/course-emails"
import {
  attendanceRows,
  attendanceSheetKey,
  attendanceSheetWindow,
  attendanceSummary,
  formatKc,
  persons,
  termsDueForAttendanceSheet,
} from "../lib/course-attendance"
import { storeAttendanceSheet } from "../lib/course-attendance-pdf"
import { checkAttachmentUrls } from "../lib/legal/order-legal"
import {
  buildEmailNotification,
  buildFeedNotification,
  getNotificationAddresses,
  resolveRecipient,
  type MerchantNotificationInput,
} from "../lib/notify"

/**
 * Prezenční listina majitelce 12 hodin před začátkem kurzu.
 *
 * Každých 15 minut se podívá na termíny, které začínají do 12 hodin. Termín
 * s aspoň jednou platnou rezervací (ne zrušený, ne skončený) dostane jednou
 * oznámení do zvonečku a e-mail s listinou v příloze (PDF) a se seznamem
 * přímo v textu — kdyby příloha neprošla, v e-mailu je to podstatné i tak.
 *
 * Jednou = klíč `mn:course-attendance:{termín}:{začátek}`. Před tvorbou PDF
 * se ověří, že oznámení s tím klíčem ještě není, takže job neplodí PDF každou
 * čtvrthodinu. Posunutý termín má jiný klíč → listina přijde k novému času.
 *
 * `notifyMerchant` přílohy neumí, proto se oznámení skládá stejnými
 * stavebními kameny (`buildFeedNotification` / `buildEmailNotification`)
 * a příloha se přidá do `data.__attachments` — tak ji čte Resend provider
 * i opakované odeslání z Přehled → Odeslané e-maily.
 */
export default async function courseAttendanceSheet(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const now = new Date()
  const { from, to } = attendanceSheetWindow(now)
  const terms = (await courseService.listCourseTerms(
    {
      status: ["published", "draft"],
      starts_at: { $gt: from, $lte: to },
    } as never,
    { relations: ["reservations"] } as never
  )) as any[]
  if (!terms.length) return

  // Už odeslané listiny — podle klíčů zvonečku (ten se zapíše vždy, i bez e-mailu).
  const keys = terms.map((term) => attendanceSheetKey(term))
  const existing = (await notifications.listNotifications(
    { idempotency_key: keys } as never,
    { take: keys.length * 2, select: ["id", "idempotency_key"] } as never
  )) as Array<{ idempotency_key?: string | null }>
  const sentKeys = new Set(existing.map((row) => String(row.idempotency_key ?? "")))

  const due = termsDueForAttendanceSheet(terms, now, sentKeys)
  if (!due.length) return

  const addresses = await getNotificationAddresses(container)
  const recipient = resolveRecipient("owner", addresses)

  for (const term of due) {
    try {
      const rows = attendanceRows(term.reservations ?? [])
      const summary = attendanceSummary(rows)
      const courseDate = formatCourseDate(term.starts_at)

      const stored = await storeAttendanceSheet(container, {
        termId: String(term.id),
        courseTitle: String(term.title ?? ""),
        courseDate,
        courseLocation: String(term.location ?? ""),
        courseDuration: formatDuration(term.duration_minutes),
        rows,
      }).catch((error) => {
        logger.warn(
          `[kurzy] Prezenční listinu (PDF) termínu ${term.id} se nepodařilo vytvořit: ${
            error instanceof Error ? error.message : String(error)
          } — e-mail odejde se seznamem v textu.`
        )
        return null
      })
      // „V příloze" slíbit jen u PDF, které si Resend opravdu stáhne (https, HEAD
      // projde) — v sandboxu bez R2 je adresa http a provider by ji vynechal.
      const attachment =
        stored && /^https:\/\//i.test(stored.url)
          ? (await checkAttachmentUrls([stored])).reachable[0] ?? null
          : null

      const input: MerchantNotificationInput = {
        key: attendanceSheetKey(term),
        title: `Prezenční listina — ${term.title}, ${courseDate}`,
        description: [
          `${term.title} · ${courseDate} · ${term.location}`,
          `Přijde ${persons(summary.people)} (${summary.reservations} ${
            summary.reservations === 1 ? "rezervace" : summary.reservations < 5 ? "rezervace" : "rezervací"
          }). Vybrat na místě celkem: ${summary.due_total > 0 ? formatKc(summary.due_total) : "nic"}.`,
          "",
          ...rows.map(
            (row) =>
              `· ${row.name} — ${persons(row.party_size)}${row.phone ? `, tel. ${row.phone}` : ""} — ${
                row.due > 0 ? `vybrat ${formatKc(row.due)}` : row.payment_note
              }${row.note ? ` (${row.note})` : ""}`
          ),
          "",
          attachment
            ? "Listinu k vytištění (s místem na podpis) najdete v příloze."
            : "Listinu k vytištění najdete v administraci u termínu (tlačítko „Prezenční listina“).",
        ].join("\n"),
        audience: "owner",
        email: true,
        resource: { id: String(term.id), type: "course_term" },
      }

      const payloads: Record<string, unknown>[] = [buildFeedNotification(input)]
      if (recipient) {
        const email = buildEmailNotification(input, recipient)
        payloads.push(
          attachment
            ? { ...email, data: { ...email.data, __attachments: [attachment] } }
            : email
        )
      } else {
        logger.warn(
          `[kurzy] Prezenční listina „${term.title}" jen do zvonečku — adresa majitelky (OWNER_NOTIFICATION_EMAIL / nastavení) chybí.`
        )
      }
      await notifications.createNotifications(payloads as never)
      logger.info(`[kurzy] Prezenční listina termínu ${term.id} odeslána majitelce.`)
    } catch (error) {
      logger.error(
        `[kurzy] Prezenční listinu termínu ${term.id} se nepodařilo poslat: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}

export const config = {
  name: "course-attendance-sheet",
  // Každou čtvrthodinu — listina přijde 12 h až 11 ¾ h před začátkem (termín
  // založený později než 12 h předem dostane listinu při nejbližším běhu).
  schedule: "*/15 * * * *",
}
