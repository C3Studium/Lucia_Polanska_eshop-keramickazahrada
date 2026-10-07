import { z } from "@medusajs/framework/zod"

export const PostStoreCreateReturnRequest = z.object({
  /** As printed on the confirmation e-mail — „#1234" and „1234" both work. */
  order_display_id: z.string().trim().min(1),
  email: z.string().trim().email(),
  /** Typovaný druh — ať se podle něj dá v adminu filtrovat a počítat lhůta. */
  kind: z.enum(["reklamace", "vraceni", "odstoupeni"]).optional(),
  /** Jen reklamace (§19/1 ZOS): co zákazník požaduje. Server ho u reklamace vyžaduje. */
  requested_resolution: z.enum(["repair", "replace", "refund"]).optional(),
  reason: z.string().trim().min(1).max(2000),
  /** Free text — which pieces are coming back, in the customer's own words. */
  items: z.string().trim().max(2000).optional(),
  /**
   * Fotky vady / zboží, aby zákazník mohl ukázat, co je špatně. Base64 (s `data:`
   * prefixem i bez), nahraje se do úložiště až po ověření vlastnictví (číslo +
   * e-mail). Stejný tvar jako u fotek zakázky (`made-to-order/media`).
   */
  photos: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mime_type: z.string().min(1),
        data: z.string().min(1),
      })
    )
    .max(6)
    .optional(),
})

export type PostStoreCreateReturnRequestType = z.infer<
  typeof PostStoreCreateReturnRequest
>
