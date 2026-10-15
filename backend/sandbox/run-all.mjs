#!/usr/bin/env node
// Spuštění / zastavení celého sandboxu.
//
//   node run-all.mjs [start] [--storefront] [--admin] [--fresh] [--no-seed] [--no-migrate]
//       1. Postgres (54329)  2. zachytávač e-mailů + maketa ComGate/ČNB (54400)
//       3. db:migrate  4. seed (idempotentní)  5. backend (9100)
//       6. volitelně storefront (8100) z kopie storefrontu (viz storefront.mjs)
//       --fresh   = smazat databázi i zachycené e-maily a začít načisto
//   node run-all.mjs restart [--no-seed] [--storefront] — znovu backend + zachytávač
//                              (migrace + seed znovu; DB i data zůstávají)
//   node run-all.mjs stop      — zastaví všechno, co sandbox spustil (i Postgres)
//   node run-all.mjs status    — co běží
//
// Procesy běží odpojeně na pozadí, logy v .logs/, PID v .run/.
import fs from "node:fs"
import path from "node:path"

import { BACKEND_DIR, BACKEND_URL, MAIL_DIR, MAIL_URL, MEDUSA_CLI, PORTS, RUN_DIR, SANDBOX_DIR, STOREFRONT_URL } from "./lib/config.mjs"
import { backendEnv } from "./lib/env.mjs"
import { isAlive, pidOnPort, portOpen, readPid, runDetached, stopNamed, waitForHttp, killTree } from "./lib/proc.mjs"
import * as db from "./db.mjs"
import { migrate, prepareLegalManifest, seed } from "./backend.mjs"

const args = process.argv.slice(2)
const cmd = args.find((a) => !a.startsWith("--")) || "start"
const flag = (f) => args.includes(f)

async function startMail() {
  if (await portOpen(PORTS.mail)) {
    console.log(`[run] zachytávač už běží (${MAIL_URL})`)
    return
  }
  const { pid, logFile } = runDetached("mail-catcher", process.execPath, [path.join(SANDBOX_DIR, "mail-catcher.mjs")], {
    cwd: SANDBOX_DIR,
  })
  await waitForHttp(`${MAIL_URL}/_health`, { timeoutMs: 20000 })
  console.log(`[run] zachytávač běží (pid ${pid}, ${MAIL_URL}, log ${logFile})`)
}

async function startBackend({ admin }) {
  if (await portOpen(PORTS.backend)) {
    console.log(`[run] na portu ${PORTS.backend} už něco běží — backend nespouštím znovu`)
    return
  }
  prepareLegalManifest()
  const { pid, logFile } = runDetached(
    "backend",
    process.execPath,
    [MEDUSA_CLI, "start", "--port", String(PORTS.backend)],
    { cwd: BACKEND_DIR, env: backendEnv({ admin }) }
  )
  console.log(`[run] backend startuje (pid ${pid}, log ${logFile}) …`)
  await waitForHttp(`${BACKEND_URL}/health`, { timeoutMs: 300000 })
  console.log(`[run] backend běží: ${BACKEND_URL}${admin ? ` (admin ${BACKEND_URL}/app)` : ""}`)
}

async function start() {
  if (flag("--fresh")) {
    await stop({ keepDb: false })
    fs.rmSync(path.join(SANDBOX_DIR, ".pgdata"), { recursive: true, force: true })
    fs.rmSync(MAIL_DIR, { recursive: true, force: true })
    fs.rmSync(path.join(RUN_DIR, "comgate-mock.json"), { force: true })
    fs.rmSync(path.join(RUN_DIR, "seed-state.json"), { force: true })
    console.log("[run] --fresh: databáze, e-maily i stav makety smazány")
  }
  await db.start()
  await startMail()
  if (!flag("--no-migrate")) await migrate()
  if (!flag("--no-seed")) await seed()
  await startBackend({ admin: flag("--admin") })
  if (flag("--storefront")) {
    const { startStorefront } = await import("./storefront.mjs")
    await startStorefront()
  }
  await status()
}

async function stop({ keepDb = false } = {}) {
  for (const name of ["storefront", "backend", "mail-catcher"]) {
    const pid = stopNamed(name)
    if (pid) console.log(`[run] zastaven ${name} (pid ${pid})`)
  }
  // Pojistka: kdyby PID soubor chyběl, ale port drží proces sandboxu.
  for (const port of [PORTS.storefront, PORTS.backend, PORTS.mail]) {
    const pid = pidOnPort(port)
    if (pid) {
      killTree(pid)
      console.log(`[run] zastaven proces na portu ${port} (pid ${pid})`)
    }
  }
  if (!keepDb) db.stop()
}

async function status() {
  const rows = [
    ["postgres", PORTS.postgres, db.isRunning()],
    ["mail-catcher", PORTS.mail, await portOpen(PORTS.mail)],
    ["backend", PORTS.backend, await portOpen(PORTS.backend)],
    ["storefront", PORTS.storefront, await portOpen(PORTS.storefront)],
  ]
  console.log("\n[run] stav sandboxu:")
  for (const [name, port, up] of rows) {
    const pid = readPid(name)
    console.log(`  ${up ? "BĚŽÍ " : "  —  "} ${String(name).padEnd(13)} :${port}${pid && isAlive(pid) ? `  (pid ${pid})` : ""}`)
  }
  console.log(`\n  e-maily:  ${MAIL_URL}/   ·  ComGate: ${MAIL_URL}/comgate/_list`)
  console.log(`  backend:  ${BACKEND_URL}/health   ·  storefront: ${STOREFRONT_URL}/cz`)
}

/** Nový kód backendu / zachytávače: zastavit je (DB i storefront nechat) a spustit znovu. */
async function restart() {
  for (const name of ["backend", "mail-catcher"]) {
    const pid = stopNamed(name)
    if (pid) console.log(`[run] zastaven ${name} (pid ${pid})`)
  }
  for (const port of [PORTS.backend, PORTS.mail]) {
    const pid = pidOnPort(port)
    if (pid) killTree(pid)
  }
  await start()
}

try {
  if (cmd === "start") await start()
  else if (cmd === "restart") await restart()
  else if (cmd === "stop") await stop()
  else if (cmd === "status") await status()
  else {
    console.error(`Neznámý příkaz: ${cmd}`)
    process.exitCode = 2
  }
} catch (e) {
  console.error(e?.message || e)
  process.exitCode = 1
}
