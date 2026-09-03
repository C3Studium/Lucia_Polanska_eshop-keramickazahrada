import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../modules/course"
import {
  normalizeUntilDayKey,
  planMultiDayOccurrences,
  planWeeklyOccurrences,
} from "../../../../modules/course/recurrence"
import type CourseModuleService from "../../../../modules/course/service"
import { serializeAdminTerm } from "../helpers"

/**
 * Terms management for the Kurzy admin page. The `/admin` namespace is
 * authenticated by the framework; the handlers still refuse a missing actor
 * out of the same caution the rest of the custom admin routes practice.
 */

const groupPricingRefinement = (
  value: { group_min?: number | null; price_group_per_person?: number | null },
  ctx: z.RefinementCtx
) => {
  const hasMin = value.group_min != null
  const hasPrice = value.price_group_per_person != null
  if (hasMin !== hasPrice) {
    ctx.addIssue({
      code: "custom",
      path: ["group_min"],
      message:
        "Skupinová cena potřebuje obojí: od kolika lidí platí i cenu za osobu.",
    })
  }
}

export const PostCourseTermSchema = z
  .object({
    title: z.string().trim().min(1, "Vyplňte název termínu.").max(200),
    location: z.string().trim().min(1, "Vyplňte místo konání.").max(200),
    /**
     * Two ways to say when. `starts_at` is the single-instant form the edit
     * path and older callers use; `days` + `time` is what the calendar
     * produces — the owner clicks the days and names one wall-clock time for
     * all of them.
     */
    starts_at: z.string().datetime({ offset: true }).optional(),
    days: z
      .array(z.string().trim())
      .min(1, "Vyberte v kalendáři aspoň jeden den.")
      .max(60)
      .optional(),
    time: z.string().trim().optional(),
    duration_minutes: z.number().int().min(15).max(24 * 60).nullable().optional(),
    capacity: z.number().int().min(1).max(500),
    price_single: z.number().min(0),
    price_two: z.number().gt(0).nullable().optional(),
    group_min: z.number().int().min(2).max(500).nullable().optional(),
    price_group_per_person: z.number().gt(0).nullable().optional(),
    status: z.enum(["draft", "published"]).default("draft"),
    note: z.string().trim().max(2000).nullable().optional(),
    /**
     * Optional weekly repetition: from every picked day, a term every week
     * (same Prague weekday and wall-clock time) through `until` inclusive.
     * `until` is a Prague calendar day "YYYY-MM-DD" (what the calendar sends)
     * or a full ISO instant; the server re-generates the occurrence list
     * itself (`modules/course/recurrence.ts`) — it never trusts a client
     * count — and caps the union at 60.
     */
    repeat: z
      .object({
        frequency: z.literal("weekly"),
        until: z.string().trim().min(1, "Vyplňte datum konce opakování."),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    groupPricingRefinement(value, ctx)
    if (!value.starts_at && !(value.days?.length && value.time)) {
      ctx.addIssue({
        code: "custom",
        path: ["days"],
        message: "Vyberte v kalendáři dny a čas začátku.",
      })
    }
  })

export const PatchCourseTermSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().min(1).max(200).optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
    duration_minutes: z.number().int().min(15).max(24 * 60).nullable().optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    price_single: z.number().min(0).optional(),
    price_two: z.number().gt(0).nullable().optional(),
    group_min: z.number().int().min(2).max(500).nullable().optional(),
    price_group_per_person: z.number().gt(0).nullable().optional(),
    /** Cancelling goes through its own route — it also sends the e-mails. */
    status: z.enum(["draft", "published", "finished"]).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    // Only cross-check when the patch touches group pricing at all.
    if (value.group_min !== undefined || value.price_group_per_person !== undefined) {
      groupPricingRefinement(value, ctx)
    }
  })

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const terms = (await courseService.listCourseTerms(
    {} as never,
    {
      relations: ["reservations", "waitlist"],
      order: { starts_at: "ASC" },
    } as never
  )) as any[]

  res.json({ terms: terms.map(serializeAdminTerm) })
}

/**
 * The instants to create, whichever way the request named them.
 *
 * Returns a Czech message instead of a list when the request cannot be read —
 * the caller turns that straight into a 400.
 */
const resolveOccurrences = (
  input: z.infer<typeof PostCourseTermSchema>
): { occurrences: string[]; truncated: boolean } | { error: string } => {
  const untilKey = input.repeat ? normalizeUntilDayKey(input.repeat.until) : null
  if (input.repeat && !untilKey) {
    return { error: "Datum konce opakování není platné." }
  }

  if (input.days?.length && input.time) {
    const plan = planMultiDayOccurrences(input.days, input.time, untilKey)
    if (!plan.ok) {
      return {
        error:
          plan.reason === "invalid_time"
            ? "Čas začátku není platný — zadejte ho ve tvaru 17:00."
            : plan.reason === "no_days"
              ? "Vyberte v kalendáři aspoň jeden den."
              : "Některý z vybraných dnů není platné datum.",
      }
    }
    return { occurrences: plan.occurrences, truncated: plan.truncated }
  }

  // Single-instant form. Without repetition it is simply one occurrence.
  const startsAt = input.starts_at as string
  if (!untilKey) {
    return { occurrences: [new Date(startsAt).toISOString()], truncated: false }
  }
  const plan = planWeeklyOccurrences(startsAt, untilKey)
  if (!plan.ok) {
    return {
      error:
        plan.reason === "until_before_start"
          ? "Konec opakování je dřív než první termín — posuňte ho na pozdější datum."
          : "Datum začátku není platné.",
    }
  }
  return { occurrences: plan.occurrences, truncated: plan.truncated }
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = PostCourseTermSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({
      message:
        parsed.error.issues[0]?.message ?? "Zkontrolujte prosím vyplněné údaje.",
    })
    return
  }

  const input = parsed.data
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const termFields = (startsAt: Date) => ({
    title: input.title,
    location: input.location,
    starts_at: startsAt,
    duration_minutes: input.duration_minutes ?? null,
    capacity: input.capacity,
    price_single: input.price_single,
    price_two: input.price_two ?? null,
    group_min: input.group_min ?? null,
    price_group_per_person: input.price_group_per_person ?? null,
    status: input.status,
    note: input.note || null,
  })

  /*
   * The server re-derives the occurrence list itself with the same pure
   * functions the calendar preview uses (`modules/course/recurrence.ts`) — the
   * client's count is display-only. Each occurrence is inserted independently:
   * a duplicate (same title + same instant, any status except cancelled) is
   * skipped, an insert error stops only that one date — partial creation with
   * honest reporting is the intended behavior, not all-or-nothing.
   */
  const resolved = resolveOccurrences(input)
  if ("error" in resolved) {
    res.status(400).json({ message: resolved.error })
    return
  }

  // Duplicate = same trimmed title (exact case — „Točení" and „točení" are
  // treated as different courses) at the same instant, any status except
  // cancelled. The guard exists so re-submitting the same repeat request is
  // harmless, and a re-submission carries the identical title.
  const existing = (await courseService.listCourseTerms(
    {} as never,
    {} as never
  )) as any[]
  const occupied = new Set(
    existing
      .filter(
        (term) =>
          term.status !== "cancelled" &&
          String(term.title ?? "").trim() === input.title
      )
      .map((term) => new Date(term.starts_at).toISOString())
  )

  const createdTerms: any[] = []
  const skippedDates: string[] = []
  const failedDates: string[] = []
  for (const occurrence of resolved.occurrences) {
    if (occupied.has(occurrence)) {
      skippedDates.push(occurrence)
      continue
    }
    try {
      const term = await courseService.createCourseTerms(
        termFields(new Date(occurrence)) as never
      )
      createdTerms.push(term)
      occupied.add(occurrence)
    } catch {
      failedDates.push(occurrence)
    }
  }

  const serialized = createdTerms.map((term) =>
    serializeAdminTerm({ ...term, reservations: [] })
  )

  res.status(201).json({
    terms: serialized,
    /** First created term — kept so a single-term caller can still read `.term`. */
    term: serialized[0] ?? null,
    created: createdTerms.length,
    skipped: skippedDates.length,
    skipped_dates: skippedDates,
    failed: failedDates.length,
    failed_dates: failedDates,
    /** True when the plan held more than 60 occurrences and was cut short. */
    truncated: resolved.truncated,
  })
}
