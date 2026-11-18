import { z } from "@medusajs/framework/zod"

const datum = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Neplatné datum.")
  .nullable()

export const VyprodejBody = z.object({
  title: z.string().trim().min(1, "Výprodej potřebuje název.").max(120),
  type: z.enum(["time", "stock"]),
  /** 1–90 %. Víc je skoro vždy překlep za pevnou cenu. */
  percent: z.number().int().min(1, "Sleva musí být aspoň 1 %.").max(90, "Sleva může být nejvýš 90 %."),
  starts_at: datum.default(null),
  ends_at: datum.default(null),
  collection_ids: z.array(z.string()).max(200).default([]),
  category_ids: z.array(z.string()).max(500).default([]),
  product_ids: z.array(z.string()).max(2000).default([]),
})

export const datesOk = (body: { starts_at?: string | null; ends_at?: string | null }) =>
  !body.starts_at || !body.ends_at || new Date(body.starts_at).getTime() < new Date(body.ends_at).getTime()
