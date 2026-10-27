import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../modules/course"
import type CourseModuleService from "../../../../modules/course/service"
import { seatsLeft } from "../../../../modules/course/pricing"
import { sendCourseRequestEmail } from "../../../../lib/course-request"
import { formatCourseDate } from "../../../../lib/course-emails"
import { notifyMerchant } from "../../../../lib/notify"

/**
 * „Dáme vědět, až se uvolní místo" — the waitlist form on a full term's card.
 *
 * Only genuinely full terms accept entries: a term with room for the party
 * is refused with a nudge to just book (waitlisting a bookable term would
 * quietly park people who could have had the seat today). Published, future
 * terms only — the same rule the reservation create enforces.
 *
 * Abuse handling mirrors the reservation POST next door: a honeypot that
 * answers success without doing anything, and a small per-e-mail window so a
 * script cannot fill the table. A repeated signup for the same term and
 * address is answered with the same success it got the first time — one
 * entry, one future notification, however often the form is submitted.
 */

const WaitlistSchema = z.object({
  term_id: z.string().trim().min(1),
  name: z.string().trim().min(2, "Vyplňte prosím jméno.").max(200),
  email: z
    .string()
    .trim()
    .email("Zkontrolujte prosím e-mailovou adresu.")
    .max(320),
  party_size: z.number().int().min(1).max(30),
  /** Telefon — majitelka u žádosti o výjimku volá. */
  phone: z.string().trim().min(6, "Zkontrolujte prosím telefon.").max(40),
  /** Vzkaz k žádosti (nepovinný). */
  note: z.string().trim().max(1000).optional(),
  /** Honeypot — humans never see the field, so any content marks a bot. */
  website: z.string().max(400).optional(),
})

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

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = WaitlistSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    res.status(400).json({
      message:
        first?.message && /[ěščřžýáíéúů]/i.test(first.message)
          ? first.message
          : "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru.",
    })
    return
  }

  const input = parsed.data

  if (input.website) {
    // A bot told it succeeded just goes away; a bot told it failed retries.
    res.status(201).json({ ok: true })
    return
  }

  const email = input.email.toLocaleLowerCase()
  if (!withinLimit(email, Date.now())) {
    res.status(429).json({
      message:
        "Přišlo příliš mnoho požadavků krátce po sobě. Zkuste to prosím za chvíli.",
    })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const terms = (await courseService.listCourseTerms(
    { id: input.term_id } as never,
    { relations: ["reservations"] } as never
  )) as any[]
  const term = terms[0]

  if (!term || term.status !== "published") {
    res.status(404).json({ message: "Termín kurzu nebyl nalezen." })
    return
  }
  if (new Date(term.starts_at).getTime() <= Date.now()) {
    res.status(400).json({ message: "Tento termín už proběhl nebo právě začíná." })
    return
  }

  const free = seatsLeft(term.capacity, term.reservations ?? [])
  if (free >= input.party_size) {
    res.status(400).json({ message: "Termín má volno — rezervujte rovnou." })
    return
  }

  // One live entry per address and term — a double submit (or an impatient
  // reload) must not queue two future notifications for one person.
  const existing = (await courseService.listCourseWaitlists(
    { term_id: term.id, email, status: "waiting" } as never
  )) as any[]
  if (existing.length) {
    res.status(201).json({ ok: true })
    return
  }

  const entry = (await courseService.createCourseWaitlists({
    term_id: term.id,
    name: input.name,
    email,
    phone: input.phone,
    note: input.note?.trim() || null,
    party_size: input.party_size,
    status: "waiting",
  } as never)) as any

  /*
   * Žádost o místo (od 28. 10. 2026): zákazník dostane potvrzení, že žádost
   * máme, majitelka zprávu s telefonem — rozhodne v administraci (Kurzy →
   * Žádosti o místo), nebo zavolá.
   */
  await sendCourseRequestEmail(req.scope, entry, term, "received").catch(() => undefined)
  await notifyMerchant(req.scope, {
    key: `course-request:${entry.id}`,
    title: `Kurzy: žádost o místo na plném termínu — ${input.name}`,
    description: [
      `${term.title} · ${formatCourseDate(term.starts_at)}`,
      `${input.party_size} os. · ${input.name} <${email}>, tel. ${input.phone}`,
      input.note ? `Vzkaz: ${input.note}` : "",
      "Rozhodněte v administraci: Kurzy → Žádosti o místo (schválit výjimku / zamítnout).",
    ]
      .filter(Boolean)
      .join(String.fromCharCode(10)),
    audience: "owner",
    email: true,
  }).catch(() => undefined)

  res.status(201).json({ ok: true })
}
