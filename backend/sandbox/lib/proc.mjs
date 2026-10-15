// Spouštění a zastavování procesů sandboxu (Windows i POSIX).
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import net from "node:net"
import path from "node:path"

import { LOG_DIR, RUN_DIR } from "./config.mjs"

/** Spustí proces v popředí a vrátí kód ukončení (výstup jde do konzole). */
export function runForeground(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", windowsHide: true, ...opts })
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)))
    child.on("error", (e) => {
      console.error(e)
      resolve(1)
    })
  })
}

/**
 * Spustí proces odpojeně na pozadí, výstup do .logs/<name>.log, PID do
 * .run/<name>.pid. Přežije konec volajícího skriptu.
 */
export function runDetached(name, cmd, args, opts) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  fs.mkdirSync(RUN_DIR, { recursive: true })
  const logFile = path.join(LOG_DIR, `${name}.log`)
  const fd = fs.openSync(logFile, "a")
  fs.writeSync(fd, `\n===== ${new Date().toISOString()} start ${name} =====\n`)
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
    ...opts,
  })
  child.unref()
  fs.closeSync(fd)
  fs.writeFileSync(path.join(RUN_DIR, `${name}.pid`), String(child.pid))
  return { pid: child.pid, logFile }
}

export function readPid(name) {
  try {
    const pid = Number(fs.readFileSync(path.join(RUN_DIR, `${name}.pid`), "utf8").trim())
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

export function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === "EPERM"
  }
}

/** Zabije proces i s potomky. */
export function killTree(pid) {
  if (!pid || !isAlive(pid)) return false
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true })
  } else {
    try {
      process.kill(-pid, "SIGTERM")
    } catch {
      try {
        process.kill(pid, "SIGTERM")
      } catch {}
    }
  }
  return true
}

export function stopNamed(name) {
  const pid = readPid(name)
  const killed = killTree(pid)
  try {
    fs.rmSync(path.join(RUN_DIR, `${name}.pid`), { force: true })
  } catch {}
  return killed ? pid : null
}

/** Je na portu (127.0.0.1) něco, co přijímá spojení? */
export function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.connect({ port, host })
    s.once("connect", () => {
      s.destroy()
      resolve(true)
    })
    s.once("error", () => resolve(false))
    s.setTimeout(1000, () => {
      s.destroy()
      resolve(false)
    })
  })
}

/** Na Windows: PID procesu, který na portu poslouchá (nebo null). */
export function pidOnPort(port) {
  if (process.platform !== "win32") return null
  const r = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true })
  for (const line of (r.stdout || "").split(/\r?\n/)) {
    const m = line.trim().match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/)
    if (m && Number(m[2]) === port) return Number(m[3])
  }
  return null
}

export async function waitFor(fn, { timeoutMs = 120000, intervalMs = 1000, label = "", rethrow = () => false } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await fn()) return true
    } catch (e) {
      if (rethrow(e)) throw e
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Vypršel čas čekání${label ? `: ${label}` : ""}`)
}

/**
 * Jeden GET přes node:http bez keep-alive → stavový kód (nebo null).
 * Ne `fetch`: opakované neúspěšné pokusy přes undici nechávaly na Windows při
 * ukončení procesu pád libuv („Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING)").
 */
export function httpStatus(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { agent: false, timeout: timeoutMs }, (res) => {
      res.resume()
      res.on("end", () => resolve(res.statusCode))
    })
    req.on("timeout", () => req.destroy())
    req.on("error", () => resolve(null))
  })
}

export async function waitForHttp(url, { timeoutMs = 240000, okStatuses = [200] } = {}) {
  return waitFor(async () => okStatuses.includes(await httpStatus(url)), {
    timeoutMs,
    intervalMs: 2000,
    label: url,
  })
}
