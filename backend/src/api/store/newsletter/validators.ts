import { z } from "@medusajs/framework/zod"

export const PostStoreNewsletterSchema = z.object({
  email: z.string().email(),
  /** Země z přepínače (`sk`, `de`…) — jazyk potvrzovacího e-mailu. */
  country_code: z.string().regex(/^[a-zA-Z]{2}$/).optional(),
})
