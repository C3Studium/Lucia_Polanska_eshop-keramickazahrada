#!/usr/bin/env node
// Backend (Medusa) proti sandboxové databázi — vždy s izolovaným prostředím
// z lib/env.mjs a pojistkou lib/env-guard.cjs.
//
//   node backend.mjs migrate            — medusa db:migrate (všechny moduly + linky)
//   node backend.mjs seed               — admin uživatel + seed.ts + údržbové skripty
//   node backend.mjs start [--admin]    — medusa start na :9100 v popředí
//   node backend.mjs watch [--admin]    — medusa develop (restart při změně kódu)
//   node backend.mjs exec <soubor.ts> [-- args]  — medusa exec se sandbox env
//   node backend.mjs check              — výpis registrovaných poskytovatelů (izolace)
//   node backend.mjs env                — jména neprázdných citlivých proměnných
import path from "node:path"
import { pathToFileURL } from "node:url"

import { ADMIN, BACKEND_DIR, MEDUSA_CLI, PORTS } from "./lib/config.mjs"
import { backendEnv, describeEnv } from "./lib/env.mjs"
import { runForeground } from "./lib/proc.mjs"
import { sql } from "./db.mjs"
import { writeSandboxManifest } from "./lib/legal-manifest.mjs"

export function medusaArgs(cmd, rest = []) {
  return [MEDUSA_CLI, cmd, ...rest]
}

/** Sandboxová kopie manifestu PDF (https sandbox host) — před každým během Medusy. */
export function prepareLegalManifest() {
  const r = writeSandboxManifest()
  if (r) console.log(`[backend] legal manifest (sandbox): ${r.summary.join(", ")}${r.allowDraft ? " — DRAFT POVOLEN" : ""}`)
  return r
}

export async function medusa(cmd, rest = [], { admin = false } = {}) {
  prepareLegalManifest()
  return runForeground(process.execPath, medusaArgs(cmd, rest), {
    cwd: BACKEND_DIR,
    env: backendEnv({ admin }),
  })
}

export async function migrate() {
  console.log("[backend] db:migrate …")
  const code = await medusa("db:migrate", ["--execute-safe-links"])
  if (code !== 0) throw new Error(`db:migrate skončil kódem ${code}`)
}

export async function ensureAdminUser() {
  const rows = await sql(`select id from "user" where email = $1 and deleted_at is null`, [ADMIN.email]).catch(() => [])
  if (rows.length) {
    console.log(`[backend] admin uživatel ${ADMIN.email} už existuje`)
    return
  }
  console.log(`[backend] zakládám admin uživatele ${ADMIN.email} …`)
  const code = await medusa("user", ["-e", ADMIN.email, "-p", ADMIN.password])
  if (code !== 0) throw new Error(`medusa user skončil kódem ${code}`)
}

export async function seed() {
  await ensureAdminUser()
  const code = await medusa("exec", ["./sandbox/seed.ts"])
  if (code !== 0) throw new Error(`seed.ts skončil kódem ${code}`)
  // Stejné údržbové kroky jako `predeploy` na produkci — data mají mít stejný tvar.
  for (const script of [
    "./src/scripts/enable-backorder-default.ts",
    "./src/scripts/sync-discountable.ts",
    "./src/scripts/backfill-inventory-levels.ts",
  ]) {
    const c = await medusa("exec", [script])
    if (c !== 0) console.warn(`[backend] ${script} skončil kódem ${c} (pokračuji)`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [cmd = "start", ...rest] = process.argv.slice(2)
  const admin = rest.includes("--admin")
  try {
    if (cmd === "migrate") await migrate()
    else if (cmd === "seed") await seed()
    else if (cmd === "user") await ensureAdminUser()
    else if (cmd === "start") process.exitCode = await medusa("start", ["--port", String(PORTS.backend)], { admin })
    else if (cmd === "watch") process.exitCode = await medusa("develop", ["--port", String(PORTS.backend)], { admin })
    else if (cmd === "exec") process.exitCode = await medusa("exec", rest)
    else if (cmd === "check") process.exitCode = await medusa("exec", ["./sandbox/check-isolation.ts"])
    else if (cmd === "env") console.log(describeEnv(backendEnv()).join("\n"))
    else {
      console.error(`Neznámý příkaz: ${cmd}`)
      process.exitCode = 2
    }
  } catch (e) {
    console.error(e?.message || e)
    process.exitCode = 1
  }
}
