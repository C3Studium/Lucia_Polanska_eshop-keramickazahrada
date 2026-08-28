/**
 * Responsive capture rig — screenshots plus the facts a screenshot cannot show.
 *
 * Scratch tooling for the responsive pass. Not part of the app; .rdshots/ is untracked.
 *
 *   node .rdshots/shoot.cjs --routes cookies,smluvni-podminky --tag before
 *   node .rdshots/shoot.cjs --all --tag after
 *
 * For every route × viewport it records, alongside the PNG:
 *   - which breakpoint the design system actually matched (evaluated in the page, against the
 *     same media queries _mixins.scss emits, so a mislabelled viewport cannot hide)
 *   - the shader verdict from <html data-fx> and why
 *   - whether the page scrolls sideways, and which elements are responsible
 *   - any text below the legibility floor, and any tap target under 44px on touch
 */

const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const BASE = process.env.RD_BASE || "http://localhost:8000"
const COUNTRY = process.env.RD_COUNTRY || "cz"
const OUT = path.join(__dirname, "out")

/* The viewport matrix. Each entry names the stop it is expected to match, and the run fails
   loudly if the page disagrees — that check is what makes the new `qhd` stop trustworthy. */
const VIEWPORTS = [
  // Portrait phones
  { id: "p-320x568", w: 320, h: 568, expect: "v-xs", touch: true },
  { id: "p-390x844", w: 390, h: 844, expect: "v-sm", touch: true },
  { id: "p-430x932", w: 430, h: 932, expect: "v-s", touch: true },
  // Portrait tablets
  { id: "p-768x1024", w: 768, h: 1024, expect: "v-md", touch: true },
  { id: "p-1024x1366", w: 1024, h: 1366, expect: "v-lg", touch: true },
  // Landscape phones
  { id: "l-568x320", w: 568, h: 320, expect: "phs", touch: true },
  { id: "l-932x430", w: 932, h: 430, expect: "phl", touch: true },
  // Landscape tablets
  { id: "l-1024x768", w: 1024, h: 768, expect: "smt", touch: true },
  { id: "l-1366x1024", w: 1366, h: 1024, expect: "mdt", touch: true },
  // Laptops and desktops
  { id: "l-1220x660", w: 1220, h: 660, expect: "lt", touch: false },
  { id: "l-1366x768", w: 1366, h: 768, expect: "lt", touch: false },
  { id: "l-1512x982", w: 1512, h: 982, expect: "xl", touch: false },
  { id: "l-1920x1080", w: 1920, h: 1080, expect: "huge", touch: false },
  { id: "l-2552x1351", w: 2552, h: 1351, expect: "qhd", touch: false },
]

/* The support and legal pages, which is the whole of this pass. */
const ROUTES = {
  cookies: "/cookies",
  "doprava-a-platba": "/doprava-a-platba",
  "ochrana-osobnich-udaju": "/ochrana-osobnich-udaju",
  "odstoupeni-od-smlouvy": "/odstoupeni-od-smlouvy",
  "smluvni-podminky": "/smluvni-podminky",
  "reklamacni-protokol": "/reklamacni-protokol",
  newsletter: "/newsletter?stav=potvrzeno",
  "newsletter-odhlaseno": "/newsletter?stav=odhlaseno",
  notfound: "/tahle-stranka-neexistuje",
}

/* /search is deliberately absent: it is a permanentRedirect to /store, and the store is out of
   scope for this pass. Capturing it would only ever photograph the store. */

/* Mirrors styles/system/_breakpoints.scss. Ordered exactly as the cascade orders it, so the LAST
   match is the stop that wins — the same rule the emitted CSS follows. */
const H_STOPS = [
  ["xxs", "(min-width: 400px)"],
  ["xs", "(min-width: 750px)"],
  ["sm", "(min-width: 900px)"],
  ["smt", "(min-width: 900px) and (max-width: 1399.98px) and (min-height: 720px)"],
  ["md", "(min-width: 1200px)"],
  ["mdt", "(min-width: 1300px) and (max-width: 1399.98px) and (min-height: 950px)"],
  ["lg", "(min-width: 1400px)"],
  ["xl", "(min-width: 1500px)"],
  ["huge", "(min-width: 1730px)"],
  ["qhd", "(min-width: 2200px) and (min-aspect-ratio: 16 / 9)"],
  ["phs", "(min-width: 480px) and (max-width: 1199.98px) and (max-height: 520px)"],
  ["phl", "(min-width: 800px) and (max-width: 1199.98px) and (max-height: 520px)"],
  ["lt", "(min-width: 1200px) and (max-height: 800px)"],
]

const V_STOPS = [
  ["v-xs", "(min-width: 320px)"],
  ["v-sm", "(min-width: 380px)"],
  ["v-s", "(min-width: 400px)"],
  ["v-md", "(min-width: 600px)"],
  ["v-lg", "(min-width: 1000px)"],
]

function parseArgs() {
  const argv = process.argv.slice(2)
  const get = (flag) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const routesArg = get("--routes")
  return {
    routes: argv.includes("--all")
      ? Object.keys(ROUTES)
      : routesArg
        ? routesArg.split(",").map((s) => s.trim()).filter(Boolean)
        : ["cookies"],
    viewports: (() => {
      const v = get("--viewports")
      if (!v) return VIEWPORTS
      const want = new Set(v.split(",").map((s) => s.trim()))
      return VIEWPORTS.filter((vp) => want.has(vp.id))
    })(),
    tag: get("--tag") || "shot",
  }
}

/* Runs in the page. Returns everything the screenshot cannot show. */
function collect([hStops, vStops]) {
  const matched = (stops) =>
    stops.filter(([, q]) => window.matchMedia(q).matches).map(([k]) => k)

  const portrait = window.matchMedia("(orientation: portrait)").matches
  const hMatches = portrait ? [] : matched(hStops)
  const vMatches = portrait ? matched(vStops) : []
  const all = portrait ? vMatches : hMatches

  const doc = document.documentElement
  const vw = doc.clientWidth

  /* Sideways scroll, and who caused it. Only elements that actually stick out past the viewport
     are named — an ancestor that is merely wide because a child is wide is not the culprit. */
  const offenders = []
  if (doc.scrollWidth > vw + 1) {
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right <= vw + 1 && r.left >= -1) continue
      const style = getComputedStyle(el)
      if (style.position === "fixed" && r.width <= vw + 1) continue
      if (style.visibility === "hidden" || style.opacity === "0") continue
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 90),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      })
      if (offenders.length >= 12) break
    }
  }

  /* Text too small to read comfortably, ignoring anything visually hidden. */
  const tiny = []
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (!el.textContent || !el.textContent.trim()) continue
    if (el.children.length > 0) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const size = parseFloat(getComputedStyle(el).fontSize)
    if (size && size < 12) {
      tiny.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
        px: Math.round(size * 10) / 10,
        text: el.textContent.trim().slice(0, 40),
      })
      if (tiny.length >= 10) break
    }
  }

  /* Tap targets under the 44px floor globals.scss sets for touch. */
  const smallTargets = []
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches
  if (coarse) {
    const sel = 'a, button, [role="button"], input, select, summary'
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.height >= 44 && r.width >= 44) continue
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent || "").trim().slice(0, 30),
      })
      if (smallTargets.length >= 12) break
    }
  }

  return {
    orientation: portrait ? "portrait" : "landscape",
    stops: all,
    winning: all.length ? all[all.length - 1] : "(none)",
    fx: doc.dataset.fx || "(unset)",
    fxReason: doc.dataset.fxReason || "(unset)",
    hoverNone: window.matchMedia("(hover: none)").matches,
    pointerCoarse: window.matchMedia("(pointer: coarse)").matches,
    ambientCanvas: !!document.querySelector("[data-global-liquid-ether] canvas"),
    scrollWidth: doc.scrollWidth,
    clientWidth: vw,
    overflow: doc.scrollWidth > vw + 1,
    offenders,
    tiny,
    smallTargets,
  }
}

async function main() {
  const { routes, viewports, tag } = parseArgs()
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch()
  const report = []

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 1,
      hasTouch: vp.touch,
      isMobile: vp.touch,
      locale: "cs-CZ",
    })

    for (const name of routes) {
      const route = ROUTES[name]
      if (!route) {
        console.error("unknown route:", name)
        continue
      }

      const page = await context.newPage()
      const url = `${BASE}/${COUNTRY}${route}`
      let status = 0

      try {
        const res = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: 45000,
        })
        status = res ? res.status() : 0
      } catch (e) {
        report.push({ route: name, viewport: vp.id, error: String(e).slice(0, 200) })
        await page.close()
        continue
      }

      /*
       * Wait for the webfonts before measuring anything.
       *
       * Without this the rig measures whatever face happened to be resolved at the shutter, and
       * fallback metrics are not the real ones. It produced a genuinely misleading baseline: the
       * footer's links came out 44px and 45px on a cold server — two different heights for one
       * element, which is the tell — and 41px on every later run, once Sansation was cached.
       * Three of us spent time treating that 3px as a regression somebody had introduced.
       *
       * `document.fonts.ready` resolves once font loading has settled. The timeout after it still
       * covers the capability probe stamping data-fx and any entrance animation.
       */
      await page
        .evaluate(() => document.fonts.ready.then(() => undefined))
        .catch(() => undefined)

      /*
       * And wait for the capability probe to stamp <html data-fx>.
       *
       * It runs in an effect after hydration, which on a busy dev server can take longer than a
       * fixed delay allows. A flat timeout left 3 of 126 captures reporting the attribute absent,
       * scattered across unrelated routes — noise that looks like a real gap and cost time to
       * rule out. Waiting for the fact itself is deterministic; the fallback timeout keeps a page
       * that genuinely never stamps from hanging the run.
       */
      await page
        .waitForFunction(() => !!document.documentElement.dataset.fx, null, {
          timeout: 5000,
        })
        .catch(() => undefined)

      await page.waitForTimeout(1200)

      const facts = await page.evaluate(collect, [H_STOPS, V_STOPS]).catch((e) => ({
        error: String(e).slice(0, 200),
      }))

      const dir = path.join(OUT, tag, name)
      fs.mkdirSync(dir, { recursive: true })
      await page.screenshot({
        path: path.join(dir, `${vp.id}.png`),
        fullPage: true,
      })

      report.push({
        route: name,
        viewport: vp.id,
        size: `${vp.w}x${vp.h}`,
        status,
        expected: vp.expect,
        ...facts,
        stopOk: facts.winning === vp.expect,
      })

      await page.close()
    }

    await context.close()
  }

  await browser.close()

  fs.writeFileSync(
    path.join(OUT, `${tag}-report.json`),
    JSON.stringify(report, null, 2)
  )

  summarise(report, tag)
}

function summarise(report, tag) {
  const line = (s) => console.log(s)
  line(`\n=== ${tag} — ${report.length} captures ===\n`)

  const bad = report.filter((r) => r.error || r.stopOk === false)
  if (bad.length) {
    line("BREAKPOINT / LOAD PROBLEMS")
    for (const r of bad) {
      line(
        `  ${r.route} @ ${r.viewport}: ${
          r.error ? r.error : `expected ${r.expected}, matched ${r.winning}`
        }`
      )
    }
    line("")
  } else {
    line("All viewports matched their expected breakpoint.\n")
  }

  line("SHADER VERDICT")
  const byReason = {}
  for (const r of report) {
    if (r.error) continue
    const k = `${r.fx} / ${r.fxReason} / canvas=${r.ambientCanvas}`
    byReason[k] = (byReason[k] || 0) + 1
  }
  for (const [k, n] of Object.entries(byReason)) line(`  ${n.toString().padStart(3)}  ${k}`)

  const over = report.filter((r) => r.overflow)
  line(`\nHORIZONTAL OVERFLOW: ${over.length} of ${report.length}`)
  for (const r of over) {
    line(`  ${r.route} @ ${r.viewport} (${r.clientWidth} -> ${r.scrollWidth})`)
    for (const o of (r.offenders || []).slice(0, 4)) {
      line(`      ${o.tag}.${o.cls} [${o.left}..${o.right}] w=${o.width}`)
    }
  }

  const tinyRows = report.filter((r) => (r.tiny || []).length)
  line(`\nTEXT UNDER 12px: ${tinyRows.length} captures`)
  for (const r of tinyRows.slice(0, 12)) {
    line(`  ${r.route} @ ${r.viewport}`)
    for (const t of r.tiny.slice(0, 3)) {
      line(`      ${t.px}px  ${t.tag}.${t.cls}  "${t.text}"`)
    }
  }

  const tapRows = report.filter((r) => (r.smallTargets || []).length)
  line(`\nTAP TARGETS UNDER 44px: ${tapRows.length} captures`)
  for (const r of tapRows.slice(0, 12)) {
    line(`  ${r.route} @ ${r.viewport}`)
    for (const t of r.smallTargets.slice(0, 4)) {
      line(`      ${t.w}x${t.h}  ${t.tag}.${t.cls}  "${t.text}"`)
    }
  }

  line("")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
