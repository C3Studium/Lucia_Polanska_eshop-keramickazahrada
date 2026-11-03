import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendCustomerEmail } from "./customer-email"
import { formatCourseDate } from "./course-emails"
import { courseReservationLink } from "./course-reservation-link"
import { getLegalFacts } from "./merchant-settings"
import { courseMessageKey, messageRecipients } from "./course-attendance"

/**
 * „Napsat všem účastníkům" — jedna zpráva majitelky všem platným
 * rezervacím termínu (`api/admin/courses/terms/[id]/message`).
 *
 * Každý účastník dostane svůj e-mail (oslovení, odkaz na jeho rezervaci),
 * s klíčem `course-message:{dávka}:{rezervace}`. Dávku vymyslí okno v adminu
 * při otevření, takže dvojklik nebo opakovaný požadavek nepošle nic dvakrát
 * a další zpráva (nové otevření okna) má klíč nový.
 *
 * Posílá se po jednom s krátkou pauzou — Resend dovolí 10 požadavků za
 * sekundu a dávka naráz už jednou skončila stovkou chyb (abandoned cart).
 * Odpověď na e-mail jde na adresu dílny z Právních údajů (Reply-To).
 */

export const COURSE_MESSAGE_TEMPLATE = "course-message"

export type CourseMessageResult = {
  sent: number
  failed: string[]
  without_email: Array<{ name: string; phone: string }>
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const defaultCourseMessageSubject = (term: { title?: unknown; starts_at?: unknown }): string =>
  `Zpráva ke kurzu ${String(term.title ?? "").trim()} — ${formatCourseDate(term.starts_at)}`

export const sendCourseMessage = async (
  container: MedusaContainer,
  term: any,
  input: { message: string; subject?: string | null; batchKey: string },
  options: { pauseMs?: number } = {}
): Promise<CourseMessageResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { recipients, withoutEmail } = messageRecipients(term.reservations ?? [])
  const { facts } = await getLegalFacts(container)
  const replyTo = String(facts["seller.email"] ?? "").trim()
  const subject = (input.subject ?? "").trim() || defaultCourseMessageSubject(term)
  const courseDate = formatCourseDate(term.starts_at)
  const pauseMs = options.pauseMs ?? 150

  let sent = 0
  const failed: string[] = []
  for (const [index, recipient] of recipients.entries()) {
    if (index > 0 && pauseMs > 0) await pause(pauseMs)
    try {
      const ok = await sendCustomerEmail(container, {
        template: COURSE_MESSAGE_TEMPLATE,
        to: recipient.email,
        key: courseMessageKey(input.batchKey, recipient.reservation_id),
        data: {
          subject,
          customerName: recipient.name,
          courseTitle: term.title,
          courseDate,
          courseLocation: term.location,
          message: input.message,
          reservationLink: courseReservationLink(recipient.reservation_id),
          canReply: Boolean(replyTo),
          ...(replyTo ? { reply_to: replyTo } : {}),
          term_id: term.id,
        },
      })
      if (ok) sent += 1
      else failed.push(recipient.name)
    } catch (error) {
      failed.push(recipient.name)
      logger.error(
        `[kurzy] Zprávu účastníkovi (rezervace ${recipient.reservation_id}) se nepodařilo odeslat: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
  return { sent, failed, without_email: withoutEmail }
}
