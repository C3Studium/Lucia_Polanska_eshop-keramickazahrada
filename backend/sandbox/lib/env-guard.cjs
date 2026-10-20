/*
 * Pojistka izolace sandboxu — načítá se do KAŽDÉHO procesu sandboxu přes
 * `NODE_OPTIONS=--require <tato cesta>` (backend, medusa exec, migrace,
 * storefront i jeho workery).
 *
 * Tři vrstvy:
 *
 * 1. Soubory `.env*` v backend/, storefront/ a v kořeni repa (a v
 *    backend/.medusa/server) jsou pro tento proces „neexistující": čtení i stat
 *    hodí ENOENT. `loadEnv` z Medusy (dotenv) i `@next/env` chybějící soubor
 *    tiše přeskočí. Ostré přístupy z `backend/.env` a `storefront/.env.local`
 *    se tak do sandboxu vůbec nedostanou — nezávisle na tom, že spouštěcí
 *    skript všechny jejich proměnné navíc nastavuje explicitně na bezpečné
 *    hodnoty (dotenv existující proměnnou nepřepíše).
 *
 * 2. Odchozí síť: `fetch` i `http(s).request` smí jen na localhost. Výjimky:
 *    - `payments.comgate.cz` se přesměruje na lokální maketu ComGate
 *      (zachytávač na 127.0.0.1:54400/comgate/…), aby šly zkoušet platby kartou,
 *    - hosty v `SANDBOX_EGRESS_ALLOW` (čárkami; jen pro čtení, např. fonty).
 *    Vše ostatní se odmítne (síťová chyba) a zapíše do .logs/egress-blocked.log.
 *
 * 3. Drátová past: kdyby přesto v procesu kdykoli (i později) byla proměnná,
 *    která míří do produkce (DATABASE_URL mimo sandbox Postgres, R2/MinIO,
 *    iDoklad, Resend mimo lokální zachytávač, Redis …), proces se okamžitě
 *    ukončí kódem 97 dřív, než stihne cokoli zapsat nebo odeslat.
 *
 * Výpis jen JMÉNA proměnných, nikdy hodnoty.
 */
"use strict"

const fs = require("fs")
const path = require("path")

const SANDBOX_DIR = path.resolve(__dirname, "..")
const BACKEND_DIR = path.resolve(SANDBOX_DIR, "..")
const REPO_DIR = path.resolve(BACKEND_DIR, "..")
const LOG_DIR = path.join(SANDBOX_DIR, ".logs")
const PROTECTED_DIRS = [
  BACKEND_DIR,
  path.join(BACKEND_DIR, ".medusa", "server"),
  path.join(REPO_DIR, "storefront"),
  REPO_DIR,
  ...(process.env.SANDBOX_EXTRA_PROTECTED_DIR ? [process.env.SANDBOX_EXTRA_PROTECTED_DIR] : []),
].map((d) => path.resolve(d).toLowerCase())

const role = process.env.SANDBOX_ROLE || "unknown"

/* ------------------------------------------------------------------ */
/* 1. Soubory .env                                                     */
/* ------------------------------------------------------------------ */

const ALLOWED_BASENAMES = new Set([".env.template", ".env.example"])
const reported = new Set()

function isBlocked(p) {
  try {
    if (p == null) return false
    let s
    if (typeof p === "string") s = p
    else if (Buffer.isBuffer(p)) s = p.toString()
    else if (p instanceof URL) s = p.protocol === "file:" ? require("url").fileURLToPath(p) : ""
    else return false
    if (!s) return false
    const abs = path.resolve(s)
    const base = path.basename(abs).toLowerCase()
    if (!(base === ".env" || base.startsWith(".env."))) return false
    if (ALLOWED_BASENAMES.has(base)) return false
    const dir = path.dirname(abs).toLowerCase()
    if (!PROTECTED_DIRS.includes(dir)) return false
    if (!reported.has(abs)) {
      reported.add(abs)
      process.stderr.write(
        `[sandbox-guard] ${role}/${process.pid}: zablokováno čtení ${path.relative(REPO_DIR, abs)}\n`
      )
    }
    return true
  } catch {
    return false
  }
}

function enoent(p, syscall) {
  const err = new Error(`ENOENT: no such file or directory, ${syscall} '${p}'`)
  err.code = "ENOENT"
  err.errno = -4058
  err.syscall = syscall
  err.path = String(p)
  return err
}

function wrapSync(obj, name) {
  const orig = obj[name]
  if (typeof orig !== "function") return
  obj[name] = function guarded(p, ...rest) {
    if (isBlocked(p)) {
      if (name === "existsSync") return false
      throw enoent(p, name.replace(/Sync$/, ""))
    }
    return orig.call(this, p, ...rest)
  }
}

function wrapCallback(obj, name) {
  const orig = obj[name]
  if (typeof orig !== "function") return
  obj[name] = function guarded(p, ...rest) {
    if (isBlocked(p)) {
      const cb = rest[rest.length - 1]
      const err = enoent(p, name)
      if (typeof cb === "function") {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return orig.call(this, p, ...rest)
  }
}

function wrapPromise(obj, name) {
  const orig = obj[name]
  if (typeof orig !== "function") return
  obj[name] = function guarded(p, ...rest) {
    if (isBlocked(p)) return Promise.reject(enoent(p, name))
    return orig.call(this, p, ...rest)
  }
}

// realpathSync záměrně ne — má vlastnost `.native`, kterou by obal ztratil.
for (const n of ["readFileSync", "statSync", "lstatSync", "existsSync", "openSync", "accessSync"]) {
  wrapSync(fs, n)
}
for (const n of ["readFile", "stat", "lstat", "open", "access"]) wrapCallback(fs, n)
{
  const orig = fs.createReadStream
  fs.createReadStream = function guarded(p, ...rest) {
    if (isBlocked(p)) throw enoent(p, "open")
    return orig.call(this, p, ...rest)
  }
}
for (const n of ["readFile", "stat", "lstat", "open", "access"]) wrapPromise(fs.promises, n)

/* ------------------------------------------------------------------ */
/* 2. Odchozí síť                                                      */
/* ------------------------------------------------------------------ */

const MOCK_BASE = process.env.SANDBOX_SERVICES_URL || "http://127.0.0.1:54400"
const REWRITE_HOSTS = {
  "payments.comgate.cz": `${MOCK_BASE}/comgate`,
  // Kurzovní lístek ČNB (přepočet balného/cen do EUR) — pevné kurzy ze zachytávače,
  // ať jsou částky v testech deterministické.
  "www.cnb.cz": `${MOCK_BASE}/cnb`,
  // PDF právních dokumentů (náhrada R2) — viz lib/legal-manifest.mjs.
  "legal.sandbox.test": `${MOCK_BASE}`,
}
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"])
const ALLOW = new Set(
  String(process.env.SANDBOX_EGRESS_ALLOW || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
)
const egressReported = new Set()

function logEgress(kind, host, detail) {
  const key = `${kind}:${host}`
  if (egressReported.has(key)) return
  egressReported.add(key)
  const line = `${new Date().toISOString()} ${role}/${process.pid} ${kind} ${host}${detail ? " " + detail : ""}\n`
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.appendFileSync(path.join(LOG_DIR, "egress-blocked.log"), line)
  } catch {}
  process.stderr.write(`[sandbox-guard] odchozí ${kind}: ${host}${detail ? " " + detail : ""}\n`)
}

/** Vrací { action: 'pass' | 'block' | 'rewrite', url? } pro absolutní URL. */
function decide(urlString) {
  let u
  try {
    u = new URL(urlString)
  } catch {
    return { action: "pass" }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { action: "pass" }
  const host = u.hostname.toLowerCase()
  if (LOCAL_HOSTS.has(host)) return { action: "pass" }
  if (REWRITE_HOSTS[host]) {
    return { action: "rewrite", url: REWRITE_HOSTS[host] + u.pathname + u.search, host }
  }
  if (ALLOW.has(host)) return { action: "pass" }
  return { action: "block", host }
}

const origFetch = globalThis.fetch
if (typeof origFetch === "function") {
  const guardedFetch = function sandboxFetch(input, init) {
    let urlString
    try {
      urlString = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url
    } catch {}
    if (urlString) {
      const d = decide(urlString)
      if (d.action === "block") {
        logEgress("BLOKOVÁNO", d.host, "(fetch)")
        return Promise.reject(new TypeError(`fetch failed (sandbox: odchozí spojení na ${d.host} je zablokované)`))
      }
      if (d.action === "rewrite") {
        logEgress("PŘESMĚROVÁNO", d.host, `→ ${d.url.split("?")[0]}`)
        if (typeof input === "string" || input instanceof URL) return origFetch.call(this, d.url, init)
        // Request objekt: přenést metodu, hlavičky a tělo.
        return origFetch.call(this, new Request(d.url, input), init)
      }
    }
    return origFetch.call(this, input, init)
  }
  globalThis.fetch = guardedFetch
}

function hostOf(args) {
  const a = args[0]
  try {
    if (typeof a === "string") return new URL(a).hostname.toLowerCase()
    if (a instanceof URL) return a.hostname.toLowerCase()
    if (a && typeof a === "object") return String(a.hostname || a.host || "localhost").replace(/:\d+$/, "").toLowerCase()
  } catch {}
  return "localhost"
}

function wrapHttp(mod, scheme) {
  for (const name of ["request", "get"]) {
    const orig = mod[name]
    if (typeof orig !== "function") continue
    mod[name] = function guardedRequest(...args) {
      const host = hostOf(args)
      if (!LOCAL_HOSTS.has(host) && !ALLOW.has(host)) {
        logEgress("BLOKOVÁNO", host, `(${scheme}.${name})`)
        // Přesměrovat na zavřený lokální port → ECONNREFUSED, knihovna to vezme
        // jako běžnou síťovou chybu.
        const cb = args.find((x) => typeof x === "function")
        return orig.call(this, { host: "127.0.0.1", port: 1, path: "/", method: "GET" }, cb)
      }
      return orig.apply(this, args)
    }
  }
}
wrapHttp(require("http"), "http")
wrapHttp(require("https"), "https")

/* ------------------------------------------------------------------ */
/* Manifest právních dokumentů                                         */
/* ------------------------------------------------------------------ */
/*
 * `require(".../backend/src/lib/legal/legal-manifest.json")` vrátí sandboxovou
 * kopii (PDF na https://legal.sandbox.test místo R2). Jen když ji spouštěcí
 * skript vyrobil a předal v SANDBOX_LEGAL_MANIFEST.
 */
{
  const target = path.join(BACKEND_DIR, "src", "lib", "legal", "legal-manifest.json").toLowerCase()
  const replacement = process.env.SANDBOX_LEGAL_MANIFEST
  if (replacement && fs.existsSync(replacement)) {
    const Module = require("module")
    const origResolve = Module._resolveFilename
    let announced = false
    Module._resolveFilename = function sandboxResolve(request, parent, ...rest) {
      const resolved = origResolve.call(this, request, parent, ...rest)
      if (typeof resolved === "string" && resolved.toLowerCase() === target) {
        if (!announced) {
          announced = true
          process.stderr.write(`[sandbox-guard] ${role}/${process.pid}: legal-manifest.json → sandboxová kopie\n`)
        }
        return replacement
      }
      return resolved
    }
  }
}

/* ------------------------------------------------------------------ */
/* Dlouhé časovače                                                     */
/* ------------------------------------------------------------------ */
/*
 * Bez Redisu plánuje Medusa joby v paměti přes setTimeout(dalšíBěh − teď).
 * Vypnutý job s rozvrhem „0 0 29 2 *" (příští 29. 2.) má zpoždění > 2^31 ms,
 * Node ho ořízne na 1 ms a job běží v nekonečné smyčce (TimeoutOverflowWarning).
 * Na produkci (Redis/BullMQ) se to neděje. Tady: časovač delší než 24,8 dne
 * v rámci běhu sandboxu prostě nikdy nevyprší — což je pro takový rozvrh
 * správné chování.
 */
{
  const MAX_DELAY = 2147483647
  const timers = require("timers")
  const origSetTimeout = timers.setTimeout
  const sandboxSetTimeout = function sandboxSetTimeout(fn, delay, ...args) {
    if (typeof delay === "number" && delay > MAX_DELAY) {
      const t = origSetTimeout(function rearm() {
        t.refresh()
      }, MAX_DELAY)
      return t
    }
    return origSetTimeout(fn, delay, ...args)
  }
  // util.promisify(setTimeout) musí dál fungovat.
  const custom = require("util").promisify.custom
  if (origSetTimeout[custom]) sandboxSetTimeout[custom] = origSetTimeout[custom]
  timers.setTimeout = sandboxSetTimeout
  globalThis.setTimeout = sandboxSetTimeout
}

try {
  require("module").syncBuiltinESMExports()
} catch {}

/* ------------------------------------------------------------------ */
/* 3. Drátová past                                                     */
/* ------------------------------------------------------------------ */

/** Proměnné, které v sandboxu musí být prázdné (nebo nenastavené). */
const MUST_BE_EMPTY = [
  "REDIS_URL",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "IDOKLAD_CLIENT_ID",
  "IDOKLAD_CLIENT_SECRET",
  "IDOKLAD_APPLICATION_ID",
  "IDOKLAD_WEBHOOK_SECRET",
  "SEGMENT_WRITE_KEY",
  "SENDGRID_API_KEY",
  "STRIPE_API_KEY",
  "BALIKOVNA_API_TOKEN",
  "BALIKOVNA_API_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CMS_ADMIN_PASSWORD",
  "CMS_SESSION_SECRET",
  "ALGOLIA_API_KEY",
  "MEILISEARCH_API_KEY",
  "SANITY_API_TOKEN",
  "IMPORT_ADMIN_PASSWORD",
  "CLARITY_API_TOKEN",
  "PAGESPEED_API_KEY",
]

/** Smí být neprázdné jen se sandboxovou hodnotou (začíná „sandbox-“). */
const SANDBOX_VALUE_ONLY = ["COMGATE_MERCHANT", "COMGATE_SECRET"]

function isLocalUrl(v) {
  try {
    const u = new URL(v)
    return LOCAL_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

function violations() {
  const env = process.env
  const out = []
  for (const k of MUST_BE_EMPTY) {
    if (env[k] && String(env[k]).trim() !== "") out.push(k)
  }
  for (const k of SANDBOX_VALUE_ONLY) {
    if (env[k] && String(env[k]).trim() !== "" && !String(env[k]).startsWith("sandbox-")) out.push(k)
  }
  if (env.DATABASE_URL) {
    try {
      const u = new URL(env.DATABASE_URL)
      if (!(isLocalUrl(env.DATABASE_URL) && u.port === "54329")) out.push("DATABASE_URL")
    } catch {
      out.push("DATABASE_URL")
    }
  }
  if (env.RESEND_API_KEY && String(env.RESEND_API_KEY).trim() !== "") {
    if (!env.RESEND_BASE_URL || !isLocalUrl(env.RESEND_BASE_URL)) out.push("RESEND_BASE_URL")
  }
  for (const k of ["MEDUSA_BACKEND_URL", "NEXT_PUBLIC_MEDUSA_BACKEND_URL", "BACKEND_PUBLIC_URL", "STOREFRONT_PUBLIC_URL"]) {
    if (env[k] && !isLocalUrl(env[k])) out.push(k)
  }
  return out
}

function check(when) {
  const bad = violations()
  if (bad.length) {
    const msg =
      `[sandbox-guard] ${role}/${process.pid}: PORUŠENÍ IZOLACE (${when}) — proměnné ${bad.join(", ")} ` +
      `nemají bezpečné hodnoty. Proces se ukončuje dřív, než cokoli zapíše nebo odešle.\n`
    // Synchronně do souboru — stderr do roury by se při process.exit mohl ztratit.
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true })
      fs.appendFileSync(path.join(LOG_DIR, "guard-violations.log"), `${new Date().toISOString()} ${msg}`)
    } catch {}
    process.stderr.write(`\n${msg}`)
    process.exit(97)
  }
}

if (process.env.SANDBOX_GUARD !== "1") {
  process.stderr.write(
    `[sandbox-guard] ${process.pid}: proces nebyl spuštěn přes skripty sandboxu (SANDBOX_GUARD≠1) — ukončuji.\n`
  )
  process.exit(97)
}

check("start")
// Medusa i Next si env dočítají až za běhu — past se proto kontroluje i dál.
const t = setInterval(() => check("běh"), 500)
if (typeof t.unref === "function") t.unref()
