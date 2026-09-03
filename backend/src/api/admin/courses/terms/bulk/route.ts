import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../../modules/course"
import {
  resolveScopeTermIds,
  type BulkScope,
} from "../../../../../modules/course/bulk-scope"
import { seatsTaken } from "../../../../../modules/course/pricing"
import type CourseModuleService from "../../../../../modules/course/service"
import { serializeAdminTerm } from "../../helpers"

/**
 * One edit, many terms — what the „Ceny" and „Poznámky" dialogs post.
 *
 * Both dialogs ask the same question („kde se to má projevit?") and both send
 * the same shape: a scope plus the fields to write. Raising the autumn price
 * or adding „vezměte si přezůvky" to every term in November is one request,
 * not fourteen.
 *
 * The scope rules — never touch a cancelled term, never let a blanket scope
 * reach into the past — live in `modules/course/bulk-scope.ts`, pure and
 * unit-tested, and the admin runs the very same function to show its honest
 * „změní 14 termínů" count before the owner commits.
 */

const ScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("terms"),
    ids: z.array(z.string().trim().min(1)).min(1, "Vyberte aspoň jeden termín."),
  }),
  z.object({ kind: z.literal("all_upcoming") }),
  z.object({
    kind: z.literal("period"),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte datum od."),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte datum do."),
  }),
])

/**
 * Only the fields the two dialogs own. Title, date and capacity deliberately
 * stay out: they are what makes a term *that* term, and changing them in bulk
 * is not an edit but a different course.
 */
const PatchSchema = z
  .object({
    note: z.string().trim().max(2000).nullable().optional(),
    price_single: z.number().min(0).optional(),
    price_two: z.number().gt(0).nullable().optional(),
    group_min: z.number().int().min(2).max(500).nullable().optional(),
    price_group_per_person: z.number().gt(0).nullable().optional(),
    capacity: z.number().int().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!Object.keys(value).length) {
      ctx.addIssue({
        code: "custom",
        path: ["patch"],
        message: "Není co uložit — nezměnili jste žádné pole.",
      })
    }
    // Group pricing is a pair: a minimum without a price (or the reverse)
    // would silently do nothing at booking time.
    const touchesGroup =
      value.group_min !== undefined || value.price_group_per_person !== undefined
    if (touchesGroup && (value.group_min == null) !== (value.price_group_per_person == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["group_min"],
        message:
          "Skupinová cena potřebuje obojí: od kolika lidí platí i cenu za osobu.",
      })
    }
  })

export const PostCourseTermsBulkSchema = z.object({
  scope: ScopeSchema,
  patch: PatchSchema,
})

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = PostCourseTermsBulkSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({
      message:
        parsed.error.issues[0]?.message ?? "Zkontrolujte prosím vyplněné údaje.",
    })
    return
  }

  const { scope, patch } = parsed.data
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const terms = (await courseService.listCourseTerms(
    {} as never,
    { relations: ["reservations"] } as never
  )) as any[]

  const targetIds = new Set(
    resolveScopeTermIds(terms as never, scope as BulkScope)
  )
  if (!targetIds.size) {
    res.status(400).json({
      message:
        "Tenhle výběr neobsahuje žádný termín, který jde upravit. Zkuste jiný rozsah.",
    })
    return
  }

  /*
   * Lowering capacity below what is already booked would mean silent
   * overbooking — the same rule the single-term PATCH enforces. In bulk it
   * cannot fail the whole request, so the terms that would overbook are left
   * untouched and named back to the owner.
   */
  const fields = {
    ...(patch.note !== undefined ? { note: patch.note || null } : {}),
    ...(patch.price_single !== undefined
      ? { price_single: patch.price_single }
      : {}),
    ...(patch.price_two !== undefined ? { price_two: patch.price_two } : {}),
    ...(patch.group_min !== undefined ? { group_min: patch.group_min } : {}),
    ...(patch.price_group_per_person !== undefined
      ? { price_group_per_person: patch.price_group_per_person }
      : {}),
    ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
  }

  const updatedIds: string[] = []
  const overbookedTitles: string[] = []
  const failedIds: string[] = []

  for (const term of terms) {
    if (!targetIds.has(term.id)) {
      continue
    }
    if (
      patch.capacity !== undefined &&
      patch.capacity < seatsTaken(term.reservations ?? [])
    ) {
      overbookedTitles.push(term.title)
      continue
    }
    try {
      await courseService.updateCourseTerms({
        id: term.id,
        ...fields,
      } as never)
      updatedIds.push(term.id)
    } catch {
      failedIds.push(term.id)
    }
  }

  const refreshed = (await courseService.listCourseTerms(
    {} as never,
    {
      relations: ["reservations", "waitlist"],
      order: { starts_at: "ASC" },
    } as never
  )) as any[]

  res.json({
    updated: updatedIds.length,
    updated_ids: updatedIds,
    /** Skipped because the new capacity was below what is already booked. */
    skipped_overbooked: overbookedTitles.length,
    skipped_overbooked_titles: overbookedTitles,
    failed: failedIds.length,
    terms: refreshed.map(serializeAdminTerm),
  })
}
