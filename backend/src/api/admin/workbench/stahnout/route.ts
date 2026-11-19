import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Stáhnout fotku do počítače (19. 11. 2026, Matěj). Prohlížeč neumí
 * `<a download>` na fotku z jiné domény (R2) — otevřel by ji, ne uložil.
 * Admin proto chodí sem: backend fotku načte a vrátí jako přílohu.
 *
 * Jen z našeho úložiště (R2 / MinIO / vlastní /static), ať se přes admin
 * nedá stahovat cokoli z internetu.
 */
const povoleneHosty = (req: MedusaRequest): Set<string> => {
  const hosty = new Set<string>(["img.matejforejt.com"])
  for (const adresa of [process.env.R2_PUBLIC_URL, process.env.MINIO_PUBLIC_URL, process.env.MEDUSA_BACKEND_URL, process.env.BACKEND_URL]) {
    try {
      if (adresa) hosty.add(new URL(adresa).host)
    } catch {
      /* neplatná adresa v proměnné — přeskočit */
    }
  }
  if (req.headers.host) hosty.add(req.headers.host)
  return hosty
}

const PRIPONY: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

/** Bezpečný název souboru bez diakritiky a mezer. */
const nazevSouboru = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "fotka"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const url = String(req.query.url ?? "")
  let cil: URL
  try {
    cil = new URL(url)
  } catch {
    res.status(400).json({ message: "Neplatná adresa fotky." })
    return
  }
  if (!/^https?:$/.test(cil.protocol) || !povoleneHosty(req).has(cil.host)) {
    res.status(400).json({ message: "Stáhnout jde jen fotku z úložiště obchodu." })
    return
  }

  const odpoved = await fetch(cil).catch(() => null)
  if (!odpoved?.ok) {
    res.status(502).json({ message: "Fotku se nepodařilo načíst z úložiště." })
    return
  }
  const typ = (odpoved.headers.get("content-type") ?? "").split(";")[0].trim()
  if (!typ.startsWith("image/")) {
    res.status(400).json({ message: "Na té adrese není obrázek." })
    return
  }
  const pripona = PRIPONY[typ] ?? (cil.pathname.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5)
  const nazev = `${nazevSouboru(String(req.query.nazev ?? "fotka"))}.${pripona}`
  const data = Buffer.from(await odpoved.arrayBuffer())

  res.setHeader("Content-Type", typ)
  res.setHeader("Content-Length", String(data.length))
  res.setHeader("Content-Disposition", `attachment; filename="${nazev}"`)
  res.setHeader("Cache-Control", "private, no-store")
  res.status(200).send(data)
}
