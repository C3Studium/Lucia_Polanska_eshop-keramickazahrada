// Maketa ComGate API v2.0 pro sandbox.
//
// Backend má adresu ComGate natvrdo (`modules/comgate/utils.ts`); pojistka
// `env-guard.cjs` ji v procesech sandboxu přesměruje sem:
//   https://payments.comgate.cz/v2.0/…  →  http://127.0.0.1:54400/comgate/v2.0/…
//
// API (jako ComGate):
//   POST   /comgate/v2.0/payment.json                 založit platbu → { code:0, transId, redirect }
//   GET    /comgate/v2.0/payment/transId/:id.json     stav platby
//   DELETE /comgate/v2.0/payment/transId/:id.json     zrušit
//   PUT    /comgate/v2.0/preauth/transId/:id.json     zachytit předautorizaci
//   DELETE /comgate/v2.0/preauth/transId/:id.json     zrušit předautorizaci
//   POST   /comgate/v2.0/refund.json                  refundace (jen se zapíše)
//   GET    /comgate/v2.0/method.json                  seznam metod
//
// Platební brána pro prohlížeč:
//   redirect = https://comgate.sandbox.test/pay/:id   (backend vyžaduje https://).
//   Ve skutečnosti stránka běží na http://127.0.0.1:54400/comgate/pay/:id —
//   Playwright přesměruje host přes context.route (viz e2e), ručně stačí
//   v adrese nahradit začátek.
//   POST /comgate/pay/:id/:vysledek (paid|cancelled|pending) → oznámení do
//   backendu + přesměrování na url_paid/url_cancelled/url_pending.
//
// Pro skripty:
//   POST /comgate/_simulate/:id  { status: "PAID"|"CANCELLED"|"AUTHORIZED"|"PENDING", notify?: true }
//   GET  /comgate/_list
import fs from "node:fs"
import path from "node:path"

import { BACKEND_URL, RUN_DIR } from "./config.mjs"

const STATE_FILE = path.join(RUN_DIR, "comgate-mock.json")
export const PAY_HOST = "https://comgate.sandbox.test"
const WEBHOOK_URL = `${BACKEND_URL}/hooks/payment/pp_comgate_comgate`

let state = { seq: 0, transactions: {}, refunds: [] }
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
} catch {}

function save() {
  fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function newTransId() {
  state.seq += 1
  const n = String(state.seq).padStart(4, "0")
  const r = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X")
  return `SBX${n}-${r}-TEST`
}

const METHODS = [
  { id: "CARD_CZ_CSOB_2", group: "CARD", groupLabel: "Platební karta", name: "Platební karta (sandbox)", name_short: "Karta", description: "Testovací karta — sandbox" },
  { id: "APPLEPAY_REDIRECT", group: "APPLEPAY", groupLabel: "Apple Pay", name: "Apple Pay (sandbox)", name_short: "Apple Pay", description: "" },
  { id: "GOOGLEPAY_REDIRECT", group: "GOOGLEPAY", groupLabel: "Google Pay", name: "Google Pay (sandbox)", name_short: "Google Pay", description: "" },
  { id: "BANK_CZ_CS_P", group: "BANK", groupLabel: "Bankovní převod", name: "Česká spořitelna (sandbox)", name_short: "ČS", description: "" },
  { id: "BANK_ALL_PSD2", group: "BANK", groupLabel: "Bankovní převod", name: "Online převod (sandbox)", name_short: "Převod", description: "" },
].map((m) => ({ ...m, logo: "", logo_120c: "", logo_240: "", logo_240c: "", logo_150s: "", logo_100s: "" }))

function details(t) {
  return {
    code: 0,
    message: "OK",
    merchant: "sandbox",
    test: t.test ? "true" : "false",
    price: String(t.price),
    curr: t.curr,
    label: t.label,
    refId: t.refId,
    payerId: t.payerId,
    method: t.method,
    email: t.email,
    phone: t.phone,
    name: t.name,
    transId: t.transId,
    status: t.status,
    fee: "unknown",
  }
}

async function notifyBackend(t) {
  const body = new URLSearchParams({
    transId: t.transId,
    refId: t.refId,
    status: t.status,
    price: String(t.price),
    curr: t.curr,
    test: t.test ? "true" : "false",
    label: t.label || "",
    method: t.method || "",
    email: t.email || "",
  })
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(60000),
    })
    const text = await res.text()
    const rec = { at: new Date().toISOString(), status: res.status, body: text.slice(0, 500) }
    t.notifications = [...(t.notifications || []), rec]
    save()
    console.log(`[comgate] oznámení ${t.transId} (${t.status}) → backend HTTP ${res.status}`)
    return rec
  } catch (e) {
    const rec = { at: new Date().toISOString(), error: String(e?.message || e) }
    t.notifications = [...(t.notifications || []), rec]
    save()
    console.log(`[comgate] oznámení ${t.transId} selhalo: ${rec.error}`)
    return rec
  }
}

function setStatus(t, status) {
  t.status = status
  t.history = [...(t.history || []), { at: new Date().toISOString(), status }]
  if (status === "PAID" && !t.paid_at) t.paid_at = new Date().toISOString()
  save()
}

function payPage(t) {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
  const amount = (t.price / 100).toFixed(2)
  return `<!doctype html><meta charset="utf-8"><title>ComGate sandbox — ${esc(t.transId)}</title>
<style>body{font:16px system-ui;max-width:560px;margin:40px auto;padding:0 16px}button{font-size:16px;padding:10px 18px;margin:6px 8px 6px 0;cursor:pointer}.box{border:1px solid #ccc;border-radius:8px;padding:16px}</style>
<h1>ComGate — SANDBOX</h1>
<div class="box">
<p><b>Platba:</b> <span data-testid="comgate-trans-id">${esc(t.transId)}</span></p>
<p><b>Částka:</b> <span data-testid="comgate-amount">${amount} ${esc(t.curr)}</span></p>
<p><b>Metoda:</b> ${esc(t.method)} · <b>Stav:</b> <span data-testid="comgate-status">${esc(t.status)}</span></p>
<p><b>E-mail:</b> ${esc(t.email)}</p>
</div>
<form method="post" action="/comgate/pay/${encodeURIComponent(t.transId)}/paid"><button data-testid="comgate-pay" type="submit">Zaplatit (PAID)</button></form>
<form method="post" action="/comgate/pay/${encodeURIComponent(t.transId)}/cancelled"><button data-testid="comgate-cancel" type="submit">Zrušit (CANCELLED)</button></form>
<form method="post" action="/comgate/pay/${encodeURIComponent(t.transId)}/pending"><button data-testid="comgate-pending" type="submit">Odejít bez výsledku (PENDING)</button></form>
<p style="color:#666">Žádná skutečná platba neproběhne. Oznámení jde do ${esc(WEBHOOK_URL)}.</p>`
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(body))
}

function parseBody(raw, contentType) {
  if (!raw) return {}
  if (String(contentType || "").includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw))
  }
  try {
    return JSON.parse(raw)
  } catch {
    return Object.fromEntries(new URLSearchParams(raw))
  }
}

/** Vrátí true, když požadavek obsloužila maketa. */
export async function handleComgate(req, res, url, raw) {
  if (!url.pathname.startsWith("/comgate/")) return false
  const p = url.pathname.slice("/comgate".length)
  const body = parseBody(raw, req.headers["content-type"])
  const auth = String(req.headers.authorization || "")
  const authOk = auth.startsWith("Basic ") && Buffer.from(auth.slice(6), "base64").toString().startsWith("sandbox-")

  // ---- API v2.0 (volá backend) ------------------------------------
  if (p.startsWith("/v2.0/")) {
    if (!authOk) return json(res, 401, { code: 1400, message: "Sandbox: chybí / neplatná Basic autorizace" }), true
    const api = p.slice("/v2.0".length)

    if (req.method === "POST" && api === "/payment.json") {
      const transId = newTransId()
      const t = {
        transId,
        created_at: new Date().toISOString(),
        status: "PENDING",
        price: Number(body.price),
        curr: String(body.curr || "CZK").toUpperCase(),
        label: body.label,
        refId: body.refId,
        payerId: body.payerId,
        method: body.method,
        email: body.email,
        phone: body.phone,
        name: body.name,
        test: body.test === true || body.test === "true",
        preauth: body.preauth === true,
        url_paid: body.url_paid,
        url_cancelled: body.url_cancelled,
        url_pending: body.url_pending,
        request: body,
        history: [{ at: new Date().toISOString(), status: "PENDING" }],
      }
      state.transactions[transId] = t
      save()
      console.log(`[comgate] nová platba ${transId}: ${t.price / 100} ${t.curr} refId=${t.refId} metoda=${t.method}`)
      return json(res, 200, { code: 0, message: "OK", transId, redirect: `${PAY_HOST}/pay/${transId}` }), true
    }

    let m = api.match(/^\/(payment|preauth)\/transId\/([^/]+)\.json$/)
    if (m) {
      const t = state.transactions[decodeURIComponent(m[2])]
      if (!t) return json(res, 200, { code: 1400, message: "Platba nenalezena" }), true
      if (req.method === "GET" && m[1] === "payment") return json(res, 200, details(t)), true
      if (req.method === "DELETE") {
        if (t.status === "PAID") return json(res, 200, { code: 1400, message: "Zaplacenou platbu nelze zrušit" }), true
        setStatus(t, "CANCELLED")
        return json(res, 200, { code: 0, message: "OK" }), true
      }
      if (req.method === "PUT" && m[1] === "preauth") {
        setStatus(t, "PAID")
        return json(res, 200, { code: 0, message: "OK" }), true
      }
    }

    if (req.method === "POST" && api === "/refund.json") {
      state.refunds.push({ at: new Date().toISOString(), ...body })
      const t = state.transactions[body.transId]
      if (t) t.refunded_minor = (t.refunded_minor || 0) + Number(body.amount || 0)
      save()
      console.log(`[comgate] refundace ${body.transId}: ${Number(body.amount) / 100}`)
      return json(res, 200, { code: 0, message: "OK" }), true
    }

    if (req.method === "GET" && api.startsWith("/method.json")) {
      return json(res, 200, { methods: METHODS }), true
    }

    return json(res, 404, { code: 1400, message: `Sandbox maketa nezná ${req.method} ${api}` }), true
  }

  // ---- Brána pro prohlížeč ----------------------------------------
  let m = p.match(/^\/pay\/([^/]+)$/)
  if (m && req.method === "GET") {
    const t = state.transactions[decodeURIComponent(m[1])]
    if (!t) return json(res, 404, { error: "platba nenalezena" }), true
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(payPage(t))
    return true
  }
  m = p.match(/^\/pay\/([^/]+)\/(paid|cancelled|pending)$/)
  if (m && req.method === "POST") {
    const t = state.transactions[decodeURIComponent(m[1])]
    if (!t) return json(res, 404, { error: "platba nenalezena" }), true
    const target = { paid: "PAID", cancelled: "CANCELLED", pending: "PENDING" }[m[2]]
    if (target !== "PENDING") {
      setStatus(t, target)
      await notifyBackend(t)
    }
    const back = target === "PAID" ? t.url_paid : target === "CANCELLED" ? t.url_cancelled : t.url_pending
    res.writeHead(303, { location: back || "/" })
    res.end()
    return true
  }

  // ---- Pro skripty -----------------------------------------------
  m = p.match(/^\/_simulate\/([^/]+)$/)
  if (m && req.method === "POST") {
    const t = state.transactions[decodeURIComponent(m[1])]
    if (!t) return json(res, 404, { error: "platba nenalezena" }), true
    const status = String(body.status || "PAID").toUpperCase()
    setStatus(t, status)
    const notification = body.notify === false || body.notify === "false" ? null : await notifyBackend(t)
    const back = status === "PAID" ? t.url_paid : status === "CANCELLED" ? t.url_cancelled : t.url_pending
    return json(res, 200, { transId: t.transId, status, notification, return_url: back }), true
  }
  if (p === "/_list" && req.method === "GET") return json(res, 200, state), true

  return json(res, 404, { error: "neznámý požadavek makety ComGate" }), true
}
