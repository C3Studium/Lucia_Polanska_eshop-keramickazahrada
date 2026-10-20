// Tenký klient Store / Admin API sandboxu + čtení zachycených e-mailů
// a notifikací. Používá ho smoke-order.mjs a e2e (fáze 2).
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

import { ADMIN, BACKEND_URL, MAIL_DIR, MAIL_URL, SEED_STATE_FILE } from "./config.mjs"
import { sql } from "../db.mjs"

export function seedState() {
  try {
    return JSON.parse(fs.readFileSync(SEED_STATE_FILE, "utf8"))
  } catch {
    throw new Error(`Chybí ${SEED_STATE_FILE} — nejdřív spusťte seed (node run-all.mjs start).`)
  }
}

export class ApiError extends Error {
  constructor(method, url, status, body) {
    super(`${method} ${url} → HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`)
    this.status = status
    this.body = body
  }
}

/**
 * HTTP přes node:http bez keep-alive, ne `fetch`: GET a POST po sobě na
 * znovupoužitém spojení undici shazovaly Node 24 na Windows při konci procesu
 * („Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)", kód 127).
 */
export function rawRequest(method, url, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body)) : null
    const req = http.request(
      url,
      {
        method,
        agent: false,
        timeout: 120000,
        headers: {
          accept: "application/json",
          connection: "close",
          ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }))
      }
    )
    req.on("timeout", () => req.destroy(new Error(`timeout ${method} ${url}`)))
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function request(method, url, { body, headers = {}, okStatuses } = {}) {
  const { status, text } = await rawRequest(method, url, { body, headers })
  const res = { status, ok: status >= 200 && status < 300 }
  let data = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {}
  if (okStatuses ? !okStatuses.includes(res.status) : !res.ok) throw new ApiError(method, url, res.status, data)
  return data
}

export function storeApi(publishableKey) {
  const headers = { "x-publishable-api-key": publishableKey }
  const u = (p) => `${BACKEND_URL}${p}`
  return {
    get: (p) => request("GET", u(p), { headers }),
    post: (p, body = {}, opts = {}) => request("POST", u(p), { body, headers, ...opts }),
    del: (p) => request("DELETE", u(p), { headers }),
  }
}

export async function adminApi() {
  const { token } = await request("POST", `${BACKEND_URL}/auth/user/emailpass`, {
    body: { email: ADMIN.email, password: ADMIN.password },
  })
  const headers = { authorization: `Bearer ${token}` }
  const u = (p) => `${BACKEND_URL}${p}`
  return {
    token,
    get: (p) => request("GET", u(p), { headers }),
    post: (p, body = {}) => request("POST", u(p), { body, headers }),
  }
}

/* ---------------- E-maily ---------------- */

export async function listMails() {
  const { text } = await rawRequest("GET", `${MAIL_URL}/api/list`)
  return JSON.parse(text)
}

/** Libovolný požadavek → { status, data } (JSON, když jde). */
export async function httpJson(method, url, body, headers = {}) {
  const { status, text } = await rawRequest(method, url, { body, headers })
  let data = text
  try {
    data = JSON.parse(text)
  } catch {}
  return { status, data }
}

/** POST na lokální službu (maketa ComGate apod.) → JSON. */
export async function postLocal(url, body) {
  const { status, text } = await rawRequest("POST", url, { body })
  let data = text
  try {
    data = JSON.parse(text)
  } catch {}
  return { status, data }
}

export function readMail(jsonFile) {
  return JSON.parse(fs.readFileSync(path.join(MAIL_DIR, jsonFile), "utf8"))
}

/** Počká, dokud se počet zachycených zpráv neustálí (nebo vyprší čas). */
export async function waitForMails({ since, minCount = 1, quietMs = 6000, timeoutMs = 60000 } = {}) {
  const t0 = Date.now()
  let last = -1
  let lastChange = Date.now()
  for (;;) {
    const all = (await listMails()).filter((m) => !since || m.received_at >= since)
    if (all.length !== last) {
      last = all.length
      lastChange = Date.now()
    }
    if (all.length >= minCount && Date.now() - lastChange >= quietMs) return all
    if (Date.now() - t0 > timeoutMs) return all
    await new Promise((r) => setTimeout(r, 1000))
  }
}

/**
 * Notifikace z DB (šablona, příjemce, stav, data.__attachments) spárované se
 * zachycenými e-maily přes external_id = id ze zachytávače.
 */
export async function notificationsSince(sinceIso, { resourceId } = {}) {
  const rows = await sql(
    `select id, "to", channel, template, status, external_id, idempotency_key, resource_id, resource_type,
            created_at, data
       from notification
      where created_at >= $1 ${resourceId ? "and (resource_id = $2 or data::text like '%' || $2 || '%')" : ""}
      order by created_at`,
    resourceId ? [sinceIso, resourceId] : [sinceIso]
  )
  const mails = await listMails()
  return rows.map((r) => {
    const mail = mails.find((m) => m.id === r.external_id)
    const data = r.data || {}
    return {
      notification_id: r.id,
      template: r.template,
      channel: r.channel,
      to: r.to,
      status: r.status,
      idempotency_key: r.idempotency_key,
      created_at: r.created_at,
      data_keys: Object.keys(data),
      data_attachments: data.__attachments ?? null,
      subject: mail?.subject ?? (typeof data.subject === "string" ? data.subject : null),
      mail_file: mail?.json ?? null,
      mail_attachments: mail?.attachments ?? null,
    }
  })
}
