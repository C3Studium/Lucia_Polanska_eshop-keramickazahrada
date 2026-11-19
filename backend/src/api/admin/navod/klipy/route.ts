import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { NAVOD_MODULE } from "../../../../modules/navod"

/**
 * Návod — GIFy k otazníkům (19. 11. 2026).
 * GET  → všechny klipy (admin i obchod) jako mapa klíč → klip.
 * POST → nahraje / přetočí jeden klip (GIF jako base64), starý soubor smaže.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const navod = req.scope.resolve(NAVOD_MODULE) as any
  const rows = await navod.listNavodKlips({}, { take: 1000 })
  res.json({ klipy: toMap(rows) })
}

const schema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,80}$/),
  area: z.enum(["admin", "store"]),
  gif_base64: z.string().min(100),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Neplatný klip.", issues: parsed.error.issues })
    return
  }
  const { key, area, gif_base64, width, height } = parsed.data
  const bytes = Buffer.from(gif_base64, "base64")
  if (bytes.subarray(0, 3).toString("ascii") !== "GIF") {
    res.status(400).json({ message: "Soubor není GIF." })
    return
  }

  const navod = req.scope.resolve(NAVOD_MODULE) as any
  const fileModule = req.scope.resolve(Modules.FILE)
  const [file] = await fileModule.createFiles([
    {
      // Nový název při každém přetočení — prohlížeč ani CDN nedrží starý.
      filename: `navod-${key.replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}.gif`,
      mimeType: "image/gif",
      content: gif_base64,
      access: "public" as const,
    },
  ])

  const [existing] = await navod.listNavodKlips({ key }, { take: 1 })
  const data = { key, area, url: file.url, file_id: file.id, width: width ?? null, height: height ?? null, bytes: bytes.length }
  const saved = existing
    ? await navod.updateNavodKlips({ id: existing.id, ...data })
    : await navod.createNavodKlips(data)

  if (existing?.file_id && existing.file_id !== file.id) {
    // Úklid starého souboru je doplněk — klip už ukazuje na nový.
    await fileModule.deleteFiles([existing.file_id]).catch(() => undefined)
  }
  res.json({ klip: pick(saved) })
}

const pick = (row: any) => ({ key: row.key, area: row.area, url: row.url, width: row.width, height: row.height })

const toMap = (rows: any[]) =>
  Object.fromEntries(rows.map((row) => [row.key, pick(row)]))
