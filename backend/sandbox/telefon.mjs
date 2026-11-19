#!/usr/bin/env node
// Sandbox na skutečném telefonu: PRODUKČNÍ sestavení storefrontu nad sandboxovým
// backendem, dostupné v místní síti na http://<IP tohoto PC>:4700.
//
//   node telefon.mjs build   — sync kopie + next build do .next-telefon
//   node telefon.mjs start   — next start -H 0.0.0.0 -p 4700 na pozadí
//   node telefon.mjs stop
//
// Proč ne `next dev` (:8100): na posuzování plynulosti a scrollu na iPhonu je
// dev moc pomalý. Proč ne ostrá data: sandbox má vlastní databázi, košík ani
// objednávka nesáhnou na produkci. Backend sandboxu musí mít v CORS původ
// :4700 (lib/env.mjs LAN_ORIGINS) — po změně restart backendu.
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { readSeedState, storefrontEnv } from "./lib/env.mjs"
import { runDetached, stopNamed } from "./lib/proc.mjs"
import { COPY_DIR, syncCopy } from "./storefront.mjs"

const PORT = 4700
const DIST = ".next-telefon"

const lanIp = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address)
    .find((a) => a.startsWith("192.168.")) ?? "127.0.0.1"

function envTelefon() {
  const state = readSeedState()
  if (!state?.publishable_key) throw new Error("Chybí publishable key — nejdřív seed (node run-all.mjs start).")
  const ip = lanIp()
  const env = storefrontEnv({ publishableKey: state.publishable_key, protectedDir: COPY_DIR })
  return {
    ...env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: DIST,
    NEXT_PUBLIC_BASE_URL: `http://${ip}:${PORT}`,
    // Adresa backendu zůstává localhost z `storefrontEnv` — pojistka izolace
    // (lib/env-guard.cjs) jinou nepustí; telefon chodí přes server Next.
  }
}

const next = path.join(COPY_DIR, "node_modules", "next", "dist", "bin", "next")

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const cmd = process.argv[2] || "start"
  if (cmd === "build") {
    syncCopy()
    const r = spawnSync(process.execPath, [next, "build"], { cwd: COPY_DIR, env: envTelefon(), stdio: "inherit" })
    process.exitCode = r.status ?? 1
  } else if (cmd === "start") {
    stopNamed("telefon")
    const { pid, logFile } = runDetached("telefon", process.execPath, [next, "start", "-H", "0.0.0.0", "-p", String(PORT)], {
      cwd: COPY_DIR,
      env: envTelefon(),
    })
    console.log(`[telefon] http://${lanIp()}:${PORT}/cz (pid ${pid}, log ${logFile})`)
  } else if (cmd === "stop") {
    console.log(stopNamed("telefon") ? "[telefon] zastaven" : "[telefon] neběžel")
  } else {
    console.error(`Neznámý příkaz: ${cmd}`)
    process.exitCode = 2
  }
}
