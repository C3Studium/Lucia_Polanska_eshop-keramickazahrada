/**
 * Can this machine afford a full-screen WebGL shader?
 *
 * This is the static half of the answer — everything knowable before a single frame has been
 * drawn. The other half is the runtime watchdog in lib/hooks/use-shaders-enabled.ts, which
 * catches the machine that passes every check here and still stutters.
 *
 * ── On VRAM ───────────────────────────────────────────────────────────────────────────────────
 * A browser cannot read how much video memory a GPU has. There is no API for it — not on the
 * WebGL context, not on `navigator`, not behind a permission prompt. `WEBGL_debug_renderer_info`
 * gives a name, and the GL limits give ceilings the driver is willing to advertise, and that is
 * the whole of it.
 *
 * So "integrated graphics with under 512 MB" is approached through the three things that do
 * correlate with it, with the runtime watchdog behind them as the real backstop:
 *
 *   1. The renderer name, for the handful of integrated families that are unambiguously below
 *      that line (Intel GMA and the first HD Graphics generations, Mali-4xx, the older Adreno
 *      and PowerVR parts).
 *   2. The GL limits. A GPU with half a gigabyte or more has reported a 16384px maximum texture
 *      since roughly 2012; 8192 and below is either a pre-2012 integrated part or a mobile SoC.
 *   3. `navigator.deviceMemory`. Integrated graphics carve their memory out of system RAM, so a
 *      2 GB machine is not giving its GPU 512 MB in any meaningful sense. Chromium-only, and it
 *      caps at 8, so a missing value is treated as "unknown", never as "low".
 *
 * None of the three is a measurement of VRAM. Together they exclude the class of machine the
 * limit was pointed at, and the watchdog removes the shaders from anything that slips through.
 */

export type ShaderVerdict = {
  allowed: boolean
  /** Why, in one token. Surfaced on <html data-fx-reason> so a real device can be diagnosed. */
  reason: string
}

/**
 * Touch devices are excluded outright, ahead of any hardware question.
 *
 * This is a decision about what the site should cost a visitor, not about what their tablet can
 * technically render. A current iPad would drive the ambient fluid simulation without dropping a
 * frame; it would also spend the battery doing it, warm the panel, and animate something behind
 * the page that nobody on a touch screen can interact with anyway — the effect follows a cursor,
 * and there is not one. Every shader on the site already ships a static image underneath, so the
 * page a tablet gets is the designed page, minus a decoration it cannot use.
 */
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)"

/* SwiftShader and llvmpipe are the browsers' own fallback rasterisers; the Microsoft names are
   what Windows reports when the driver is missing or the GPU is blocklisted. */
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|software|basic render|microsoft basic|generic renderer/i

/* Vendor families that only ship as separate cards, plus the discrete-only Intel line. A card of
   its own is the part that does the work, and a machine that has one is not a machine that
   stutters — this passes on its own, before any of the integrated-graphics tests below. */
const DISCRETE_RENDERER =
  /nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|\brx \d{3,4}\b|\bintel\b.*\barc\b/i

const APPLE_RENDERER = /apple\s?(m\d|gpu|graphics)/i

/**
 * Integrated parts that are below the line by name.
 *
 * Deliberately short. Every entry is a family that shipped with well under 512 MB of addressable
 * graphics memory and cannot run a full-screen fragment shader at a sensible frame rate — not a
 * guess at where "slow" begins. Anything weak but not listed is caught by the limits floor below
 * or by the runtime watchdog; a name this list gets wrong costs a capable machine its shaders,
 * which is the expensive direction to be wrong in.
 */
const WEAK_INTEGRATED_RENDERER =
  /\bgma\b|\bintel\b.*\bhd graphics\s*(2000|2500|3000|4000)\b|\bmali-?4\d{2}\b|\badreno\b.*\b[23]\d{2}\b|\bpowervr\b.*\bsgx\b|\bvideocore\b/i

/**
 * The limits floor. 16384 has been the maximum texture size on anything with real memory behind
 * it for over a decade, so 8192 is a full generation below the floor rather than a close call.
 */
const MIN_TEXTURE_SIZE = 8192

/**
 * Integrated graphics share system RAM. Under 4 GB there is no configuration in which the GPU
 * has half a gigabyte to work with, whatever the driver advertises.
 */
const MIN_DEVICE_MEMORY_GB = 4

type GpuFacts = {
  renderer: string
  maxTextureSize: number
  maxRenderbufferSize: number
}

export function probeShaderCapability(): ShaderVerdict {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { allowed: false, reason: "ssr" }
  }

  /* Both of these are the user asking for less, and outrank any amount of hardware. */
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return { allowed: false, reason: "reduced-motion" }
  }

  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection

  if (connection?.saveData) {
    return { allowed: false, reason: "save-data" }
  }

  if (window.matchMedia?.(TOUCH_QUERY).matches) {
    return { allowed: false, reason: "touch" }
  }

  const gpu = readGpu()

  /* No WebGL2 at all, or a CPU rasteriser pretending to be a GPU: the shaders would run, slowly,
     on the main thread's budget. */
  if (gpu === null) {
    return { allowed: false, reason: "no-webgl2" }
  }

  if (SOFTWARE_RENDERER.test(gpu.renderer)) {
    return { allowed: false, reason: "software-renderer" }
  }

  /* A card of its own is enough on its own. Checked before the integrated tests so that an older
     discrete GPU is never failed by a limit written for shared memory. */
  if (DISCRETE_RENDERER.test(gpu.renderer)) {
    return { allowed: true, reason: "discrete-gpu" }
  }

  if (WEAK_INTEGRATED_RENDERER.test(gpu.renderer)) {
    return { allowed: false, reason: "weak-integrated-gpu" }
  }

  if (
    gpu.maxTextureSize < MIN_TEXTURE_SIZE ||
    gpu.maxRenderbufferSize < MIN_TEXTURE_SIZE
  ) {
    return { allowed: false, reason: "gpu-limits-below-floor" }
  }

  /* Apple Silicon reports an integrated GPU and handles these shaders comfortably. It also does
     not report deviceMemory, so it has to clear the gate before that test. */
  if (APPLE_RENDERER.test(gpu.renderer)) {
    return { allowed: true, reason: "apple-gpu" }
  }

  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0

  /* 0 means "not reported" — Safari and Firefox never send it — and must not read as "low". */
  if (memory > 0 && memory < MIN_DEVICE_MEMORY_GB) {
    return { allowed: false, reason: "low-system-memory" }
  }

  /* Integrated, modern, and nothing above disqualified it: fall back to the rest of the machine.
     The bar clears a recent many-core laptop and excludes the thin two- and four-core ones. */
  const cores = navigator.hardwareConcurrency ?? 0

  if (cores >= 8 && (memory === 0 || memory >= 8)) {
    return { allowed: true, reason: "capable-integrated-gpu" }
  }

  return { allowed: false, reason: "thin-machine" }
}

/**
 * The renderer string and the two limits that matter, or null when WebGL2 is unavailable.
 *
 * The context is created at 1×1, read, and released immediately — the probe must not leave a
 * live context behind, since browsers cap how many a page may hold and the real shaders need
 * those slots.
 */
function readGpu(): GpuFacts | null {
  let canvas: HTMLCanvasElement | null = null
  let gl: WebGL2RenderingContext | null = null

  try {
    canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1

    gl = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    }) as WebGL2RenderingContext | null

    if (!gl) return null

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info")

    /* Firefox hides the unmasked string behind a pref; RENDERER is the masked fallback and still
       distinguishes a software rasteriser from anything else. */
    const value = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)

    return {
      renderer: typeof value === "string" ? value : "",
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? 0,
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) ?? 0,
    }
  } catch {
    return null
  } finally {
    gl?.getExtension("WEBGL_lose_context")?.loseContext()

    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
