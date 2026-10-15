#!/usr/bin/env node
// Storefront sandboxu na http://localhost:8100.
//
// Proč z kopie, a ne přímo ze storefront/:
// - `storefront/.next` používá vývojový server jiného agenta (port 8000) —
//   dva `next dev` v jednom distDir se navzájem rozbijí;
// - jiný distDir by Next zapsal do sledovaného `storefront/tsconfig.json`
//   (přidává `<distDir>/types/**/*.ts` do include) — změna mimo sandbox;
// - souborové úložiště ValeCMS bez Supabase zapisuje do `.cms-dev/store.json`
//   (sledovaný soubor).
// Kopie leží MIMO repo (%LOCALAPPDATA%\keramickazahrada-sandbox\storefront),
// aby se moduly nemohly omylem dohledat v backend/node_modules (jiný React).
// Zrcadlí se jen zdrojové složky a konfigurace; node_modules je junction na
// storefront/node_modules (nikdy se nekopíruje ani nemaže). .env* se nekopíruje.
//
//   node storefront.mjs sync     — jen zrcadlit kopii (+ synchronizace stylů)
//   node storefront.mjs start    — sync + next dev -p 8100 na pozadí
//   node storefront.mjs stop
//   node storefront.mjs fg       — sync + next dev v popředí
//   node storefront.mjs clean    — smazat kopii (junction se jen odpojí)
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { PORTS, STOREFRONT_DIR, STOREFRONT_URL } from "./lib/config.mjs"
import { readSeedState, storefrontEnv } from "./lib/env.mjs"
import { httpStatus, isAlive, portOpen, runDetached, runForeground, stopNamed, waitFor } from "./lib/proc.mjs"

const COPY_ROOT = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "keramickazahrada-sandbox")
export const COPY_DIR = path.join(COPY_ROOT, "storefront")

const MIRROR_DIRS = ["src", "public", "scripts", "content", ".cms-dev"]
const MIRROR_FILES = [
  "package.json",
  "next.config.mjs",
  "tsconfig.json",
  "tailwind.config.js",
  "postcss.config.js",
  "check-env-variables.js",
  "next-sitemap.js",
  "valecms-env.d.ts",
  ".c12.mjs",
  ".c9.mjs",
]

function mirrorDir(name) {
  const src = path.join(STOREFRONT_DIR, name)
  const dst = path.join(COPY_DIR, name)
  if (!fs.existsSync(src)) return
  if (process.platform === "win32") {
    // /MIR v rámci jedné složky; /XJ = nikdy nesledovat junctiony; .env* ven.
    const r = spawnSync(
      "robocopy",
      [src, dst, "/MIR", "/XJ", "/XF", ".env*", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"],
      { stdio: "ignore", windowsHide: true }
    )
    if (r.status >= 8) throw new Error(`robocopy ${name} selhal (kód ${r.status})`)
  } else {
    fs.rmSync(dst, { recursive: true, force: true })
    fs.cpSync(src, dst, { recursive: true, filter: (p) => !path.basename(p).startsWith(".env") })
  }
}

function ensureJunction() {
  const link = path.join(COPY_DIR, "node_modules")
  const target = path.join(STOREFRONT_DIR, "node_modules")
  let ok = false
  try {
    ok = fs.realpathSync(link).toLowerCase() === fs.realpathSync(target).toLowerCase()
  } catch {}
  if (ok) return
  try {
    const st = fs.lstatSync(link)
    // Jen odpojit odkaz — nikdy rekurzivně mazat (mířil by do skutečných node_modules).
    if (st.isSymbolicLink()) fs.unlinkSync(link)
    else throw new Error(`${link} existuje a není odkaz — smažte ho ručně`)
  } catch (e) {
    if (e.code !== "ENOENT") throw e
  }
  fs.symlinkSync(target, link, "junction")
}

export function syncCopy() {
  fs.mkdirSync(COPY_DIR, { recursive: true })
  for (const d of MIRROR_DIRS) mirrorDir(d)
  for (const f of MIRROR_FILES) {
    const src = path.join(STOREFRONT_DIR, f)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(COPY_DIR, f))
  }
  ensureJunction()
  // Totéž co `predev` + `sync:styles` v package.json — jen v kopii.
  const env = { ...process.env }
  const steps = [
    [path.join(COPY_DIR, "node_modules", "@c3studium", "valecms", "valescss", "sync.mjs")],
    [path.join(COPY_DIR, "scripts", "gen-palette.mjs")],
    [path.join(COPY_DIR, "scripts", "sync-styles.js")],
  ]
  for (const args of steps) {
    if (!fs.existsSync(args[0])) continue
    const r = spawnSync(process.execPath, args, { cwd: COPY_DIR, env, stdio: "ignore", windowsHide: true })
    if (r.status !== 0) console.warn(`[storefront] ${path.basename(args[0])} skončil kódem ${r.status}`)
  }
  console.log(`[storefront] kopie srovnána: ${COPY_DIR}`)
}

function nextArgs() {
  return [path.join(COPY_DIR, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(PORTS.storefront)]
}

function envFor() {
  const state = readSeedState()
  if (!state?.publishable_key) throw new Error("Chybí publishable key — nejdřív seed (node run-all.mjs start).")
  return storefrontEnv({ publishableKey: state.publishable_key, protectedDir: COPY_DIR })
}

export async function startStorefront() {
  if (await portOpen(PORTS.storefront)) {
    console.log(`[storefront] na portu ${PORTS.storefront} už něco běží`)
    return
  }
  syncCopy()
  // Next dev na Windows občas skončí hned po „Starting…“ bez hlášky —
  // proto hlídat, jestli proces žije, a jednou to zkusit znovu.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { pid, logFile } = runDetached("storefront", process.execPath, nextArgs(), { cwd: COPY_DIR, env: envFor() })
    console.log(`[storefront] next dev startuje (pid ${pid}, log ${logFile}) …`)
    try {
      // První překlad stránky trvá — /cz se zkompiluje při prvním požadavku.
      await waitFor(
        async () => {
          if (!isAlive(pid)) throw Object.assign(new Error("next dev skončil"), { died: true })
          return (await httpStatus(`${STOREFRONT_URL}/cz`, 120000)) === 200
        },
        { timeoutMs: 600000, intervalMs: 2000, label: `${STOREFRONT_URL}/cz`, rethrow: (e) => e?.died }
      )
      console.log(`[storefront] běží: ${STOREFRONT_URL}/cz`)
      return
    } catch (e) {
      if (!e?.died || attempt === 2) throw e
      console.warn(`[storefront] next dev skončil předčasně (viz ${logFile}) — zkouším znovu`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const cmd = process.argv[2] || "start"
  try {
    if (cmd === "sync") syncCopy()
    else if (cmd === "start") await startStorefront()
    else if (cmd === "stop") console.log(stopNamed("storefront") ? "[storefront] zastaven" : "[storefront] neběžel")
    else if (cmd === "fg") {
      syncCopy()
      process.exitCode = await runForeground(process.execPath, nextArgs(), { cwd: COPY_DIR, env: envFor() })
    } else if (cmd === "clean") {
      const link = path.join(COPY_DIR, "node_modules")
      try {
        if (fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link)
      } catch {}
      // Pojistka: dokud odkaz na skutečné node_modules existuje, nic nemazat.
      if (fs.existsSync(link)) throw new Error(`${link} se nepodařilo odpojit — nic nemažu`)
      fs.rmSync(COPY_DIR, { recursive: true, force: true })
      console.log(`[storefront] kopie smazána: ${COPY_DIR}`)
    } else {
      console.error(`Neznámý příkaz: ${cmd}`)
      process.exitCode = 2
    }
  } catch (e) {
    console.error(e?.message || e)
    process.exitCode = 1
  }
}
