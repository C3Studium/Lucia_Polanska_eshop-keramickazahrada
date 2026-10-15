#!/usr/bin/env node
// Zachytávač e-mailů — lokální náhrada Resend API na http://localhost:54400.
//
// Resend SDK (backend) čte RESEND_BASE_URL a posílá sem místo na api.resend.com.
// Každá zpráva se uloží do .mail/:
//   <čas>-<nn>-<předmět>.json  — to, from, subject, tags, headers, reply_to,
//                                přílohy (filename, path/url, stav stažení, bajty,
//                                sha256, zda je to PDF) a id
//   <čas>-<nn>-<předmět>.html  — vykreslené HTML
//   <čas>-<nn>-<předmět>.att/  — stažené / dekódované přílohy
//   index.jsonl                — jeden řádek na zprávu (pro rychlý výpis)
//
// Endpointy:
//   POST /emails, POST /emails/batch      — jako Resend; odpověď { id } / { data: [{ id }] }
//   GET  /emails/:id                      — uložená zpráva (last_event: delivered)
//   GET  /                                — HTML přehled zachycených zpráv
//   GET  /api/list                        — JSON přehled (index)
//   GET  /view/<soubor>                   — HTML/JSON/příloha zprávy
//   POST /_reset                          — smaže zachycené zprávy
//   /comgate/…                            — maketa ComGate (lib/comgate-mock.mjs)
//   /cnb/…                                — kurzovní lístek ČNB s pevnými kurzy (EUR 25,000)
//   GET|HEAD /legal/<soubor>.pdf          — PDF ze storefront/public/legal (náhrada R2, jen čtení)
//   cokoli jiného                         — 200 {} a záznam do .mail/_other.jsonl
import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

import { handleComgate } from "./lib/comgate-mock.mjs"
import { MAIL_DIR, PORTS, STOREFRONT_DIR } from "./lib/config.mjs"

const LEGAL_PUBLIC_DIR = path.join(STOREFRONT_DIR, "public", "legal")

fs.mkdirSync(MAIL_DIR, { recursive: true })
const INDEX = path.join(MAIL_DIR, "index.jsonl")
let counter = 0

function slug(s, max = 60) {
  return (
    String(s || "bez-predmetu")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, max) || "zprava"
  )
}

function stamp(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`
}

function safeName(s) {
  return String(s || "priloha").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120)
}

function toBuffer(content) {
  if (content == null) return null
  if (typeof content === "string") return Buffer.from(content, "base64")
  if (Array.isArray(content)) return Buffer.from(content)
  if (typeof content === "object" && content.type === "Buffer" && Array.isArray(content.data)) {
    return Buffer.from(content.data)
  }
  return null
}

async function processAttachment(att, attDir) {
  const rec = {
    filename: att?.filename ?? null,
    content_type: att?.content_type ?? att?.contentType ?? null,
    path: att?.path ?? null,
    has_content: att?.content != null,
  }
  let buf = null
  try {
    if (att?.content != null) {
      buf = toBuffer(att.content)
      rec.source = "content"
    } else if (typeof att?.path === "string" && /^https?:\/\//i.test(att.path)) {
      rec.source = "url"
      // Sandboxová náhrada R2 (lib/legal-manifest.mjs) → stejný soubor u nás.
      const fetchUrl = att.path.replace(/^https?:\/\/legal\.sandbox\.test\//i, `http://127.0.0.1:${PORTS.mail}/`)
      if (fetchUrl !== att.path) rec.resolved_via = "sandbox-legal-host"
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) })
      rec.fetch_status = res.status
      rec.fetch_content_type = res.headers.get("content-type")
      if (res.ok) buf = Buffer.from(await res.arrayBuffer())
    } else if (att?.path) {
      rec.source = "path-not-url"
    }
  } catch (e) {
    rec.fetch_error = String(e?.message || e)
  }
  if (buf) {
    rec.bytes = buf.length
    rec.sha256 = crypto.createHash("sha256").update(buf).digest("hex")
    rec.is_pdf = buf.subarray(0, 5).toString("latin1") === "%PDF-"
    if (rec.is_pdf) {
      const m = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)
      rec.pdf_pages_approx = m ? m.length : null
    }
    fs.mkdirSync(attDir, { recursive: true })
    const file = path.join(attDir, safeName(rec.filename || `priloha-${Date.now()}`))
    fs.writeFileSync(file, buf)
    rec.saved_as = path.relative(MAIL_DIR, file).replace(/\\/g, "/")
  }
  return rec
}

async function store(email, meta) {
  counter += 1
  const id = `sbx_${Date.now()}_${counter}`
  const base = `${stamp()}-${String(counter).padStart(3, "0")}-${slug(email?.subject)}`
  const attDir = path.join(MAIL_DIR, `${base}.att`)
  const attachments = []
  for (const att of Array.isArray(email?.attachments) ? email.attachments : []) {
    attachments.push(await processAttachment(att, attDir))
  }
  const record = {
    id,
    received_at: new Date().toISOString(),
    endpoint: meta.endpoint,
    auth_is_sandbox_key: meta.auth === "Bearer re_sandbox",
    from: email?.from ?? null,
    to: email?.to ?? null,
    cc: email?.cc ?? null,
    bcc: email?.bcc ?? null,
    reply_to: email?.reply_to ?? email?.replyTo ?? null,
    subject: email?.subject ?? null,
    tags: email?.tags ?? null,
    headers: email?.headers ?? null,
    scheduled_at: email?.scheduled_at ?? null,
    has_html: typeof email?.html === "string",
    html_bytes: typeof email?.html === "string" ? Buffer.byteLength(email.html) : 0,
    has_text: typeof email?.text === "string",
    attachments,
    files: { json: `${base}.json`, html: typeof email?.html === "string" ? `${base}.html` : null },
  }
  fs.writeFileSync(path.join(MAIL_DIR, `${base}.json`), JSON.stringify(record, null, 2))
  if (typeof email?.html === "string") fs.writeFileSync(path.join(MAIL_DIR, `${base}.html`), email.html)
  if (typeof email?.text === "string") fs.writeFileSync(path.join(MAIL_DIR, `${base}.txt`), email.text)
  fs.appendFileSync(
    INDEX,
    JSON.stringify({
      id,
      received_at: record.received_at,
      to: record.to,
      subject: record.subject,
      attachments: attachments.map((a) => ({ filename: a.filename, bytes: a.bytes ?? null, is_pdf: a.is_pdf ?? null, fetch_status: a.fetch_status ?? null })),
      json: record.files.json,
    }) + "\n"
  )
  const atts = attachments.length
    ? ` [přílohy: ${attachments.map((a) => `${a.filename}${a.bytes != null ? ` ${a.bytes}B` : " NESTAŽENO"}`).join(", ")}]`
    : ""
  console.log(`[mail] ${id} → ${JSON.stringify(record.to)} „${record.subject}“${atts}`)
  return record
}

function readIndex() {
  try {
    return fs
      .readFileSync(INDEX, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

function findById(id) {
  const row = readIndex().find((r) => r.id === id)
  if (!row) return null
  try {
    return JSON.parse(fs.readFileSync(path.join(MAIL_DIR, row.json), "utf8"))
  } catch {
    return null
  }
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type })
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
}

function listPage() {
  const rows = readIndex().reverse()
  const tr = rows
    .map((r) => {
      const base = r.json.replace(/\.json$/, "")
      const atts = (r.attachments || [])
        .map((a) => `${escapeHtml(a.filename)} (${a.bytes ?? "—"} B${a.is_pdf ? ", PDF" : ""})`)
        .join("<br>")
      return `<tr><td>${escapeHtml(r.received_at)}</td><td>${escapeHtml([].concat(r.to || []).join(", "))}</td>
<td><a href="/view/${encodeURIComponent(base)}.html">${escapeHtml(r.subject)}</a></td>
<td>${atts || "—"}</td><td><a href="/view/${encodeURIComponent(r.json)}">json</a></td></tr>`
    })
    .join("\n")
  return `<!doctype html><meta charset="utf-8"><title>Sandbox — zachycené e-maily</title>
<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left;vertical-align:top}</style>
<h1>Zachycené e-maily (${rows.length})</h1>
<table><tr><th>čas</th><th>komu</th><th>předmět</th><th>přílohy</th><th></th></tr>${tr}</table>`
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTS.mail}`)
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString("utf8")
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = null
  }
  const meta = { endpoint: `${req.method} ${url.pathname}`, auth: req.headers.authorization }

  try {
    if (await handleComgate(req, res, url, raw)) return
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/legal/")) {
      // PDF právních dokumentů — jen čtení ze storefront/public/legal (náhrada R2).
      const name = path.basename(decodeURIComponent(url.pathname.slice("/legal/".length)))
      const file = path.join(LEGAL_PUBLIC_DIR, name)
      if (!name || !file.startsWith(LEGAL_PUBLIC_DIR) || !fs.existsSync(file)) {
        return send(res, 404, { error: "PDF nenalezeno", file: name })
      }
      const buf = fs.readFileSync(file)
      res.writeHead(200, { "content-type": "application/pdf", "content-length": buf.length })
      return res.end(req.method === "HEAD" ? undefined : buf)
    }
    if (req.method === "GET" && url.pathname.startsWith("/cnb/")) {
      // Kurzovní lístek ČNB s pevnými kurzy (formát jako denni_kurz.txt).
      const d = new Date()
      const p2 = (n) => String(n).padStart(2, "0")
      const body = [
        `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} #200`,
        "země|měna|množství|kód|kurz",
        "EMU|euro|1|EUR|25,000",
        "Polsko|zlotý|1|PLN|5,800",
        "USA|dolar|1|USD|23,000",
        "Maďarsko|forint|100|HUF|6,300",
        "Velká Británie|libra|1|GBP|29,000",
      ].join("\n")
      return send(res, 200, body + "\n", "text/plain; charset=utf-8")
    }
    if (req.method === "POST" && url.pathname === "/emails") {
      const rec = await store(body || {}, meta)
      return send(res, 200, { id: rec.id })
    }
    if (req.method === "POST" && url.pathname === "/emails/batch") {
      const list = Array.isArray(body) ? body : []
      const data = []
      for (const e of list) data.push({ id: (await store(e, meta)).id })
      return send(res, 200, { data })
    }
    if (req.method === "GET" && url.pathname.startsWith("/emails/")) {
      const id = decodeURIComponent(url.pathname.slice("/emails/".length))
      const rec = findById(id)
      if (!rec) return send(res, 404, { name: "not_found", message: "Email not found", statusCode: 404 })
      return send(res, 200, {
        object: "email",
        id: rec.id,
        to: [].concat(rec.to || []),
        from: rec.from,
        subject: rec.subject,
        created_at: rec.received_at,
        last_event: "delivered",
      })
    }
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, listPage(), "text/html; charset=utf-8")
    if (req.method === "GET" && url.pathname === "/api/list") return send(res, 200, readIndex())
    if (req.method === "GET" && url.pathname.startsWith("/view/")) {
      const rel = decodeURIComponent(url.pathname.slice("/view/".length))
      const file = path.resolve(MAIL_DIR, rel)
      if (!file.startsWith(MAIL_DIR) || !fs.existsSync(file)) return send(res, 404, { error: "nenalezeno" })
      const ext = path.extname(file).toLowerCase()
      const type =
        ext === ".html" ? "text/html; charset=utf-8" : ext === ".json" ? "application/json; charset=utf-8" : ext === ".pdf" ? "application/pdf" : "application/octet-stream"
      return send(res, 200, fs.readFileSync(file), type)
    }
    if (req.method === "POST" && url.pathname === "/_reset") {
      for (const f of fs.readdirSync(MAIL_DIR)) fs.rmSync(path.join(MAIL_DIR, f), { recursive: true, force: true })
      counter = 0
      console.log("[mail] reset")
      return send(res, 200, { ok: true })
    }
    if (req.method === "GET" && url.pathname === "/_health") return send(res, 200, { ok: true, count: readIndex().length })

    // Cokoli jiného (audiences, contacts, domains …) — přijmout a zapsat.
    fs.appendFileSync(
      path.join(MAIL_DIR, "_other.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), method: req.method, path: url.pathname, body }) + "\n"
    )
    console.log(`[mail] (jiný požadavek) ${req.method} ${url.pathname}`)
    return send(res, 200, { id: `sbx_other_${Date.now()}`, object: "sandbox", data: [] })
  } catch (e) {
    console.error("[mail] chyba:", e)
    return send(res, 500, { name: "application_error", message: String(e?.message || e) })
  }
})

server.listen(PORTS.mail, "127.0.0.1", () => {
  console.log(`[mail] zachytávač běží na http://localhost:${PORTS.mail} (ukládá do ${MAIL_DIR})`)
})
