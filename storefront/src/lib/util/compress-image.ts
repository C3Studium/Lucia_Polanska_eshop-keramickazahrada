import type { CommissionUpload } from "@lib/util/made-to-order"

/**
 * Zmenší a zkomprimuje fotku v prohlížeči do malého JPEG, než se pošle.
 *
 * Fotky k zakázce jedou jako base64 v JSON (store API nemá multipart) — plná
 * fotka z telefonu (3–8 MB) tak nafoukne request přes limity (413) a zbytečně
 * sežere úložiště. Tohle ji ještě na klientovi zmenší na rozumný rozměr a stlačí
 * na ~`TARGET_BYTES`, takže se posílá pár set kB místo megabajtů.
 *
 * Kreslí přes `<canvas>` — žádná knihovna navíc do buildu. EXIF orientaci řeší
 * `createImageBitmap({ imageOrientation: "from-image" })`; co prohlížeč neumí
 * dekódovat (typicky HEIC na desktopu), skončí výjimkou a volající spadne zpět
 * na originál.
 */

/** Cíl velikosti výsledného JPEG (base64 dekódované), ~800 kB dle zadání. */
const TARGET_BYTES = 800 * 1024
/** Delší strana fotky — nad tohle nemá reference pro výrobu smysl. */
const MAX_DIM = 2000
const MIN_QUALITY = 0.5

/** Odhad bajtů z délky base64 části dataURL (4 znaky ≈ 3 bajty). */
const approxBytes = (dataUrl: string) => {
  const comma = dataUrl.indexOf(",")
  const b64 = comma > -1 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.ceil((b64.length * 3) / 4)
}

type Drawable = CanvasImageSource & { width: number; height: number }

const loadDrawable = async (file: File): Promise<Drawable> => {
  if (typeof createImageBitmap === "function") {
    try {
      return (await createImageBitmap(file, {
        imageOrientation: "from-image",
      })) as Drawable
    } catch {
      // Spadne zpět na <img> (nebo úplně ven, u HEIC).
    }
  }
  return await new Promise<Drawable>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img as unknown as Drawable)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("image load failed"))
    }
    img.src = url
  })
}

export async function compressImage(file: File): Promise<CommissionUpload> {
  if (typeof document === "undefined") {
    throw new Error("compressImage runs in the browser only")
  }

  const source = await loadDrawable(file)
  const scale = Math.min(1, MAX_DIM / Math.max(source.width, source.height))
  let w = Math.max(1, Math.round(source.width * scale))
  let h = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    ;(source as any).close?.()
    throw new Error("no 2d context")
  }

  let quality = 0.85
  let dataUrl = ""
  // Nejdřív zkoušej snižovat kvalitu, pak teprve rozměr — kvalita je levnější
  // ztráta než ostrost. Strop pokusů, ať se to nikdy nezacyklí.
  for (let attempt = 0; attempt < 9; attempt++) {
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(source, 0, 0, w, h)
    dataUrl = canvas.toDataURL("image/jpeg", quality)
    if (approxBytes(dataUrl) <= TARGET_BYTES) break
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.12)
    } else {
      w = Math.max(1, Math.round(w * 0.82))
      h = Math.max(1, Math.round(h * 0.82))
    }
  }

  ;(source as any).close?.()

  if (!dataUrl) throw new Error("compression produced nothing")

  const base = file.name.replace(/\.[^.]+$/, "").trim() || "zakazka-foto"
  return { filename: `${base}.jpg`, mime_type: "image/jpeg", data: dataUrl }
}
