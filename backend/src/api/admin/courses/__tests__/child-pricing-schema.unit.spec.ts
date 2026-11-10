import { PostCourseTermsBulkSchema } from "../terms/bulk/route"
import {
  PatchCourseTermSchema,
  PostCourseTermSchema,
  childPricingPatch,
} from "../terms/route"

/*
 * Vypínač množstevní slevy a dětská cena (9. 11. 2026): admin je posílal,
 * schémata je neznala a zod je tiše zahodil — dialog Ceny pak hlásil „Není co
 * uložit" a průvodce zakládal termíny bez dětské ceny. Tenhle test drží, že
 * všechny tři cesty je propustí.
 */
const child = { volume_pricing_enabled: false, price_child: 430, child_max_age: 15 }

describe("dětská cena a vypínač slevy projdou schématy", () => {
  it("hromadné uložení cen", () => {
    const parsed = PostCourseTermsBulkSchema.parse({
      scope: { kind: "all_upcoming" },
      patch: child,
    })
    expect(parsed.patch).toEqual(child)
  })

  it("jen vypnutí slevy není prázdný patch", () => {
    const parsed = PostCourseTermsBulkSchema.safeParse({
      scope: { kind: "all_upcoming" },
      patch: { volume_pricing_enabled: false },
    })
    expect(parsed.success).toBe(true)
  })

  it("založení termínu průvodcem", () => {
    const parsed = PostCourseTermSchema.parse({
      title: "Kurz",
      location: "Ateliér",
      days: ["2026-11-18"],
      time: "17:00",
      capacity: 12,
      price_single: 500,
      ...child,
    })
    expect(childPricingPatch(parsed)).toEqual(child)
  })

  it("úprava jednoho termínu", () => {
    expect(childPricingPatch(PatchCourseTermSchema.parse(child))).toEqual(child)
  })

  it("smazání dětské ceny (null) se pošle, vynechání ne", () => {
    expect(childPricingPatch({ price_child: null })).toEqual({ price_child: null })
    expect(childPricingPatch({})).toEqual({})
  })
})
