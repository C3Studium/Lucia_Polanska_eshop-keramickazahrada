/**
 * Device-profile test for the shader capability probe.
 *
 * Headless Chromium reports no GPU at all, so a browser run can only ever exercise the refusal
 * paths. This drives the real module — transpiled from source, not reimplemented — against
 * synthetic profiles, so the machines that are supposed to KEEP their shaders are covered too.
 *
 *   node .rdshots/probe-test.cjs
 */

const fs = require("fs")
const path = require("path")
const Module = require("module")

const esbuild = require(
  path.join(
    __dirname,
    "..",
    "node_modules",
    ".pnpm",
    "esbuild@0.25.8",
    "node_modules",
    "esbuild"
  )
)

const SRC = path.join(__dirname, "..", "src", "lib", "util", "shader-capability.ts")

function loadProbe() {
  const source = fs.readFileSync(SRC, "utf8")
  const { code } = esbuild.transformSync(source, {
    loader: "ts",
    format: "cjs",
    target: "node18",
  })

  const mod = new Module(SRC, null)
  mod.filename = SRC
  mod.paths = Module._nodeModulePaths(path.dirname(SRC))
  mod._compile(code, SRC)
  return mod.exports.probeShaderCapability
}

/* A minimal WebGL2 stand-in: only the parameters the probe actually reads. */
function fakeGl(profile) {
  const P = {
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    RENDERER: 0x1f01,
    UNMASKED_RENDERER_WEBGL: 0x9246,
  }

  return {
    ...P,
    getExtension(name) {
      if (name === "WEBGL_debug_renderer_info") {
        return { UNMASKED_RENDERER_WEBGL: P.UNMASKED_RENDERER_WEBGL }
      }
      if (name === "WEBGL_lose_context") return { loseContext() {} }
      return null
    },
    getParameter(p) {
      if (p === P.UNMASKED_RENDERER_WEBGL || p === P.RENDERER) return profile.renderer
      if (p === P.MAX_TEXTURE_SIZE) return profile.maxTexture ?? 16384
      if (p === P.MAX_RENDERBUFFER_SIZE) return profile.maxRenderbuffer ?? 16384
      return 0
    },
  }
}

function install(profile) {
  const media = (query) => {
    if (query.includes("prefers-reduced-motion")) return !!profile.reducedMotion
    if (query.includes("hover: none")) return !!profile.touch
    return false
  }

  globalThis.window = {
    matchMedia: (q) => ({ matches: media(q) }),
  }

  /* Node 18+ ships its own `navigator`, and it is a getter with no setter — a plain assignment
     is silently dropped, leaving the probe reading this machine's real core count. That failure
     mode is invisible and it makes thin-machine profiles pass, so it must be defineProperty. */
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      hardwareConcurrency: profile.cores ?? 8,
      ...(profile.deviceMemory !== undefined
        ? { deviceMemory: profile.deviceMemory }
        : {}),
      ...(profile.saveData ? { connection: { saveData: true } } : {}),
    },
  })

  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => (profile.webgl2 === false ? null : fakeGl(profile)),
    }),
  }
}

/* Each case names the machine, then the verdict it must produce. */
const CASES = [
  // ── Should KEEP shaders ─────────────────────────────────────────────────────────────────────
  {
    name: "Desktop, NVIDIA RTX 4070",
    profile: { renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, deviceMemory: 8 },
    expect: [true, "discrete-gpu"],
  },
  {
    name: "Desktop, AMD Radeon RX 6700",
    profile: { renderer: "ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, deviceMemory: 8 },
    expect: [true, "discrete-gpu"],
  },
  {
    name: "MacBook Air M2 (trackpad)",
    profile: { renderer: "Apple M2", cores: 8 },
    expect: [true, "apple-gpu"],
  },
  {
    name: "Laptop, Intel Iris Xe, 8 cores / 8GB",
    profile: { renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, D3D11)", cores: 8, deviceMemory: 8 },
    expect: [true, "capable-integrated-gpu"],
  },
  {
    name: "Laptop, Intel UHD 620, 8 cores, memory not reported (Firefox)",
    profile: { renderer: "Intel(R) UHD Graphics 620", cores: 8 },
    expect: [true, "capable-integrated-gpu"],
  },

  // ── Should LOSE shaders ─────────────────────────────────────────────────────────────────────
  {
    name: "iPad Pro (touch, very capable GPU)",
    profile: { renderer: "Apple GPU", touch: true, cores: 8 },
    expect: [false, "touch"],
  },
  {
    name: "Android phone (touch, Adreno)",
    profile: { renderer: "Adreno (TM) 730", touch: true, cores: 8, deviceMemory: 8 },
    expect: [false, "touch"],
  },
  {
    name: "Windows tablet with a discrete GPU, in tablet mode",
    profile: { renderer: "NVIDIA GeForce RTX 3050", touch: true, cores: 8, deviceMemory: 8 },
    expect: [false, "touch"],
  },
  {
    name: "Desktop, driver missing — software rasteriser",
    profile: { renderer: "Google SwiftShader", cores: 8, deviceMemory: 8 },
    expect: [false, "software-renderer"],
  },
  {
    name: "Old desktop, Intel HD Graphics 3000",
    profile: { renderer: "Intel(R) HD Graphics 3000", cores: 4, deviceMemory: 4 },
    expect: [false, "weak-integrated-gpu"],
  },
  {
    name: "Old integrated part, 4096px texture ceiling",
    profile: { renderer: "Mesa DRI Intel(R) Ivybridge Mobile", cores: 4, maxTexture: 4096 },
    expect: [false, "gpu-limits-below-floor"],
  },
  {
    name: "Thin laptop, integrated, 2GB system RAM",
    profile: { renderer: "Intel(R) UHD Graphics", cores: 4, deviceMemory: 2 },
    expect: [false, "low-system-memory"],
  },
  {
    name: "Netbook, integrated, 4 cores / 4GB",
    profile: { renderer: "Intel(R) UHD Graphics 600", cores: 4, deviceMemory: 4 },
    expect: [false, "thin-machine"],
  },
  {
    name: "Desktop, WebGL2 unavailable",
    profile: { renderer: "", webgl2: false, cores: 8 },
    expect: [false, "no-webgl2"],
  },
  {
    name: "Desktop with OS reduced-motion set",
    profile: { renderer: "NVIDIA GeForce RTX 4090", reducedMotion: true, cores: 16 },
    expect: [false, "reduced-motion"],
  },
  {
    name: "Desktop on a metered connection (Save-Data)",
    profile: { renderer: "NVIDIA GeForce RTX 4090", saveData: true, cores: 16 },
    expect: [false, "save-data"],
  },
]

function run() {
  let failures = 0

  console.log("\n=== shader capability probe — device profiles ===\n")

  for (const c of CASES) {
    install(c.profile)

    /* Re-transpiled per case: the module caches nothing, but the probe is called fresh so that a
       future cache inside it cannot silently make every later case pass. */
    const probe = loadProbe()
    const got = probe()
    const [wantAllowed, wantReason] = c.expect
    const ok = got.allowed === wantAllowed && got.reason === wantReason

    if (!ok) failures += 1

    console.log(
      `${ok ? "  ok  " : "  FAIL"}  ${c.name}\n` +
        `        want ${wantAllowed ? "on " : "off"} / ${wantReason}\n` +
        `        got  ${got.allowed ? "on " : "off"} / ${got.reason}`
    )
  }

  console.log(
    `\n${CASES.length - failures}/${CASES.length} passed` +
      (failures ? ` — ${failures} FAILED\n` : "\n")
  )

  process.exit(failures ? 1 : 0)
}

run()
