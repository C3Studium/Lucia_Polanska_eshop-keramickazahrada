#!/usr/bin/env node
// Kouřový test rezervace kurzu přes Store API (jako RezervaceModal).
//
//   node smoke-course.mjs [--payment=on_site|online] [--party=1] [--no-consent]
//
// online → ComGate (lokální maketa): rezervace vrátí payment_url, maketa se
// „zaplatí" a oznámení jde do backendu. Výsledek: .artifacts/course-<id>.json
import fs from "node:fs"
import path from "node:path"

import { ARTIFACTS_DIR, MAIL_URL } from "./lib/config.mjs"
import { notificationsSince, postLocal, seedState, storeApi, waitForMails } from "./lib/api.mjs"
import { sql } from "./db.mjs"

const arg = (name, def) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : def
}
const flag = (name) => process.argv.slice(2).includes(`--${name}`)
const log = (...a) => console.log("[course]", ...a)

async function main() {
  const state = seedState()
  const store = storeApi(state.publishable_key)
  const startedAt = new Date().toISOString()
  const payment = arg("payment", "on_site")
  const email = arg("email", `kurz+${Date.now()}@sandbox.test`)

  const { terms } = await store.get("/store/courses/terms")
  const term = terms.find((t) => t.id === state.course_term_id) ?? terms[0]
  if (!term) throw new Error("Žádný vypsaný termín kurzu — spusťte seed.")
  log(`termín ${term.id} „${term.title}“ ${term.starts_at} (volno ${term.seats_left ?? "?"})`)

  const body = {
    term_id: term.id,
    name: "Testovací Účastník",
    email,
    phone: "+420777000222",
    party_size: Number(arg("party", "1")),
    payment_method: payment,
    website: "",
    ...(flag("no-consent")
      ? {}
      : {
          terms_accepted: true,
          exception_ack: true,
          photo_consent: false,
          terms_version: arg("terms-version", "2026-10-15"),
          client_accepted_at: new Date().toISOString(),
        }),
  }
  let res
  try {
    res = await store.post("/store/courses/reservations", body)
  } catch (e) {
    log(`rezervace odmítnuta: HTTP ${e.status} ${JSON.stringify(e.body)}`)
    if (flag("no-consent")) return
    throw e
  }
  log(`rezervace ${res.reservation_id ?? res.reservation?.id} ${res.payment_url ? `→ platba ${res.payment_url}` : ""}`)

  let comgate = null
  if (res.payment_url) {
    const transId = String(res.payment_url).split("/pay/")[1]
    comgate = (await postLocal(`${MAIL_URL}/comgate/_simulate/${transId}`, { status: "PAID" })).data
    log(`ComGate maketa: ${transId} → PAID, oznámení HTTP ${comgate.notification?.status}`)
  }

  await waitForMails({ since: startedAt, minCount: 1, quietMs: 8000, timeoutMs: 60000 })
  const id = res.reservation_id ?? res.reservation?.id
  const [reservation] = await sql(
    `select id, status, payment_method, party_size, email, consents, created_at from course_reservation where id = $1`,
    [id]
  )
  const notifications = await notificationsSince(startedAt)
  const result = { reservation, comgate, notifications }
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
  const file = path.join(ARTIFACTS_DIR, `course-${id}.json`)
  fs.writeFileSync(file, JSON.stringify(result, null, 2))

  console.log("\n===== course_reservation =====")
  console.log(JSON.stringify(reservation, null, 2))
  console.log("\n===== e-maily / notifikace =====")
  for (const n of notifications) {
    const atts = (n.mail_attachments || []).map((a) => `${a.filename} (${a.bytes ?? "nestaženo"} B)`)
    console.log(`- [${n.channel}] ${n.template} → ${n.to} | ${n.status} | „${n.subject ?? "—"}“${atts.length ? ` | přílohy: ${atts.join(", ")}` : ""}`)
  }
  console.log(`\n[course] uloženo: ${file}`)
}

main().catch((e) => {
  console.error("[course] CHYBA:", e?.message || e)
  process.exitCode = 1
})
