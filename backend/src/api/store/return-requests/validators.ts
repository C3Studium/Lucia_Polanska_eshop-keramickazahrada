import { z } from "@medusajs/framework/zod"

export const PostStoreCreateReturnRequest = z.object({
  /** As printed on the confirmation e-mail — „#1234" and „1234" both work. */
  order_display_id: z.string().trim().min(1),
  email: z.string().trim().email(),
  reason: z.string().trim().min(1).max(2000),
  /** Free text — which pieces are coming back, in the customer's own words. */
  items: z.string().trim().max(2000).optional(),
})

export type PostStoreCreateReturnRequestType = z.infer<
  typeof PostStoreCreateReturnRequest
>
