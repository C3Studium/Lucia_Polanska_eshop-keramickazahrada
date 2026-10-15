#!/usr/bin/env node
// Vestavěný Postgres sandboxu (embedded-postgres, binárky pro Windows x64).
//
//   node db.mjs init     — založí cluster v .pgdata (jen když tam ještě není)
//   node db.mjs start    — spustí server na 127.0.0.1:54329 (na pozadí, přežije
//                          ukončení tohoto skriptu) a založí databázi medusa_sandbox
//   node db.mjs stop     — zastaví server (pg_ctl stop -m fast)
//   node db.mjs status   — běží / neběží
//   node db.mjs reset    — stop + smazat .pgdata + init + start (čistá databáze)
//   node db.mjs sql "<SQL>" — jednorázový dotaz do medusa_sandbox (výpis JSON)
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

import EmbeddedPostgres from "embedded-postgres"

import { LOG_DIR, PG, PG_DATA_DIR, PORTS, SANDBOX_DIR } from "./lib/config.mjs"

const require = createRequire(import.meta.url)
const pg = require("pg")

// Balíček nevystavuje package.json v `exports` — cesta se skládá přímo.
const nativeDir = path.join(SANDBOX_DIR, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin")
const PG_CTL = path.join(nativeDir, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl")
const LOG_FILE = path.join(LOG_DIR, "postgres.log")

function isInitialised() {
  return fs.existsSync(path.join(PG_DATA_DIR, "PG_VERSION"))
}

export async function init() {
  if (isInitialised()) {
    console.log(`[db] cluster už existuje: ${PG_DATA_DIR}`)
    return
  }
  fs.mkdirSync(path.dirname(PG_DATA_DIR), { recursive: true })
  const epg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: PG.user,
    password: PG.password,
    port: PORTS.postgres,
    persistent: true,
    // UTF8 + C locale: na Windows by jinak initdb vzal kódování podle systému
    // (WIN1250) a čeština v datech by se rozbila.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (e) => console.error("[db]", e),
  })
  console.log("[db] initdb …")
  await epg.initialise()
  console.log(`[db] cluster založen v ${PG_DATA_DIR}`)
}

function pgCtl(args, opts = {}) {
  const r = spawnSync(PG_CTL, args, { encoding: "utf8", windowsHide: true, ...opts })
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}`.trim() }
}

export function isRunning() {
  if (!isInitialised()) return false
  return pgCtl(["status", "-D", PG_DATA_DIR]).code === 0
}

async function client(database = "postgres") {
  const c = new pg.Client({
    host: PG.host,
    port: PORTS.postgres,
    user: PG.user,
    password: PG.password,
    database,
  })
  await c.connect()
  return c
}

export async function ensureDatabase() {
  const c = await client()
  try {
    const r = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [PG.database])
    if (!r.rowCount) {
      await c.query(`CREATE DATABASE "${PG.database}" ENCODING 'UTF8' TEMPLATE template0`)
      console.log(`[db] databáze ${PG.database} založena`)
    }
  } finally {
    await c.end()
  }
}

export async function start() {
  await init()
  if (isRunning()) {
    console.log(`[db] už běží na 127.0.0.1:${PORTS.postgres}`)
  } else {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    // pg_ctl spustí postgres odpojeně — přežije konec tohoto skriptu.
    // stdio: ignore — postgres by jinak zdědil roury a spawnSync by čekal,
    // dokud server neskončí (tj. navždy).
    const r = pgCtl([
      "start",
      "-D", PG_DATA_DIR,
      "-l", LOG_FILE,
      "-w",
      "-t", "60",
      "-o", `-p ${PORTS.postgres} -c listen_addresses=127.0.0.1 -c max_connections=200 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
    ], { stdio: "ignore" })
    if (r.code !== 0 || !isRunning()) {
      throw new Error(`[db] pg_ctl start selhal (kód ${r.code}), viz ${LOG_FILE}`)
    }
    console.log(`[db] běží na 127.0.0.1:${PORTS.postgres} (log ${LOG_FILE})`)
  }
  await ensureDatabase()
}

export function stop() {
  if (!isRunning()) {
    console.log("[db] neběží")
    return
  }
  const r = pgCtl(["stop", "-D", PG_DATA_DIR, "-m", "fast", "-w", "-t", "60"])
  if (r.code !== 0) {
    console.error(r.out)
    throw new Error(`[db] pg_ctl stop selhal (kód ${r.code})`)
  }
  console.log("[db] zastaven")
}

export async function reset() {
  stop()
  fs.rmSync(PG_DATA_DIR, { recursive: true, force: true })
  console.log("[db] .pgdata smazáno")
  await start()
}

export async function sql(text, params = []) {
  const c = await client(PG.database)
  try {
    const r = await c.query(text, params)
    return r.rows
  } finally {
    await c.end()
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  const cmd = process.argv[2] || "status"
  try {
    if (cmd === "init") await init()
    else if (cmd === "start") await start()
    else if (cmd === "stop") stop()
    else if (cmd === "reset") await reset()
    else if (cmd === "status") console.log(isRunning() ? `[db] běží (127.0.0.1:${PORTS.postgres})` : "[db] neběží")
    else if (cmd === "sql") console.log(JSON.stringify(await sql(process.argv[3]), null, 2))
    else {
      console.error(`Neznámý příkaz: ${cmd}. Použití: node db.mjs init|start|stop|status|reset|sql "<SQL>"`)
      process.exit(2)
    }
  } catch (e) {
    console.error(e?.message || e)
    process.exit(1)
  }
}
