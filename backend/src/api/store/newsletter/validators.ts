import { z } from "@medusajs/framework/zod"

export const PostStoreNewsletterSchema = z.object({
  email: z.string().email()
})
