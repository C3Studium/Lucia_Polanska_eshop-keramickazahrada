#!/usr/bin/env node
// Fáze 2 — testovací objednávky přes skutečné UI storefrontu (Playwright).
//
//   node e2e.mjs [scénáře…]       výchozí: všechny v pořadí níže
//   node e2e.mjs report           jen znovu sestavit .artifacts/report.md z výsledků
//
// Scénáře:
//   cookies     lišta cookies při první návštěvě, žádné google* požadavky
//   a           běžný výrobek → checkout → ComGate (maketa) → objednávka
//   b           výrobek na zakázku: zadání + poučení → záloha přes ComGate
//   c           poukaz s vlastní částkou ze stránky produktu → košík → objednávka
//   d           rezervace kurzu (RezervaceModal), platba na místě
//   e           dobírka (CZ, Česká pošta na adresu)
//   f           „Koupit ihned“ (přihlášený zákazník s uloženou adresou)
//   withdrawal  online odstoupení (§ 1830a) od objednávky ze scénáře a
//   complaint   reklamace na další objednávce (založené přes API)
//
// Předpoklad: běží sandbox (node run-all.mjs start --storefront).
// Výstup: .artifacts/e2e/*.png, .artifacts/e2e-results.json, .artifacts/report.md
//
// Prohlížeč smí jen na localhost. https://comgate.sandbox.test se mapuje na
// maketu ComGate (127.0.0.1:54400/comgate); vše ostatní se zablokuje a zapíše
// (u scénáře cookies je to zároveň důkaz, že před souhlasem nic nejde ven).
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

import { ARTIFACTS_DIR, BACKEND_URL, MAIL_DIR, MAIL_URL, SANDBOX_DIR, STOREFRONT_DIR, STOREFRONT_URL } from "./lib/config.mjs"
import { adminApi, httpJson, notificationsSince, seedState, storeApi } from "./lib/api.mjs"
import { sql } from "./db.mjs"

const require = createRequire(path.join(STOREFRONT_DIR, "package.json"))
const { chromium } = require("playwright")

const SHOTS = path.join(ARTIFACTS_DIR, "e2e")
const RESULTS_FILE = path.join(ARTIFACTS_DIR, "e2e-results.json")
const ORDER_BUTTON = "Objednávka zavazující k platbě"
const COURSE_BUTTON = "Rezervace zavazující k platbě"

fs.mkdirSync(SHOTS, { recursive: true })

const log = (...a) => console.log("[e2e]", ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadResults() {
  try {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"))
  } catch {
    return {}
  }
}
function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
}

/* ------------------------------------------------------------------ */
/* Prohlížeč                                                           */
/* ------------------------------------------------------------------ */

let browser

async function newContext({ consent = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
  })
  const external = []
  const requests = []
  await ctx.route("**/*", async (route) => {
    const req = route.request()
    let url
    try {
      url = new URL(req.url())
    } catch {
      return route.continue()
    }
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue()
    requests.push({ host: url.hostname, url: url.href.slice(0, 300), type: req.resourceType(), at: new Date().toISOString() })
    if (url.hostname === "comgate.sandbox.test") {
      const p = url.pathname.startsWith("/comgate/") ? url.pathname : `/comgate${url.pathname}`
      const response = await route.fetch({ url: `${MAIL_URL}${p}${url.search}`, maxRedirects: 0 })
      return route.fulfill({ response })
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return route.continue()
    external.push({ url: url.href.slice(0, 300), type: req.resourceType(), at: new Date().toISOString() })
    return route.abort("blockedbyclient")
  })
  if (consent) {
    await ctx.addCookies([
      {
        name: "kz-cookie-consent",
        value: encodeURIComponent(
          JSON.stringify({ preferences: false, analytics: false, marketing: false, version: 2, decidedAt: new Date().toISOString() })
        ),
        domain: "localhost",
        path: "/",
      },
    ])
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(180000)
  const consoleErrors = []
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message || e).slice(0, 300)))
  return { ctx, page, external, requests, consoleErrors }
}

async function shot(page, name, opts = {}) {
  const file = path.join(SHOTS, `${name}.png`)
  try {
    if (opts.locator) await opts.locator.screenshot({ path: file })
    else await page.screenshot({ path: file, fullPage: opts.fullPage ?? true })
    return path.relative(ARTIFACTS_DIR, file).replace(/\\/g, "/")
  } catch (e) {
    log(`snímek ${name} se nepovedl: ${e.message}`)
    return null
  }
}

async function goto(page, p) {
  await page.goto(`${STOREFRONT_URL}${p}`, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {})
}

/* ------------------------------------------------------------------ */
/* Kroky pokladny                                                      */
/* ------------------------------------------------------------------ */

async function addToCart(page, handle, { voucherAmount } = {}) {
  await goto(page, `/cz/products/${handle}`)
  if (voucherAmount != null) {
    const input = page.getByTestId("voucher-amount-input")
    await input.waitFor()
    await input.fill(String(voucherAmount))
    await input.blur()
  }
  const btn = page.getByRole("button", { name: /Přidat do košíku/ }).first()
  await btn.waitFor()
  await btn.click()
  await page.getByText(/Přidáno do košíku/).first().waitFor({ timeout: 60000 }).catch(() => {})
  await page.waitForLoadState("networkidle").catch(() => {})
}

async function cartIdFromCookies(ctx) {
  const cookies = await ctx.cookies(STOREFRONT_URL)
  return cookies.find((c) => c.name === "_medusa_cart_id")?.value ?? null
}

async function fillAddress(page, { email, country = "cz" }) {
  await goto(page, `/${country}/checkout?step=address`)
  await page.getByTestId("shipping-first-name-input").waitFor()
  await page.getByTestId("shipping-first-name-input").fill("Testovací")
  await page.getByTestId("shipping-last-name-input").fill("Zákazník")
  await page.getByTestId("shipping-address-input").fill("Testovací 12")
  await page.getByTestId("shipping-postal-code-input").fill("39701")
  await page.getByTestId("shipping-city-input").fill("Písek")
  await page.getByTestId("shipping-email-input").fill(email)
  await page.getByTestId("shipping-phone-input").fill("777000111")
  await page.getByTestId("submit-address-button").click()
  await page.waitForURL(/step=delivery/, { timeout: 120000 })
  await page.getByTestId("delivery-options-container").waitFor()
}

async function chooseDelivery(page, label) {
  const option = page.getByTestId("delivery-option-radio").filter({ hasText: label }).first()
  await option.waitFor()
  await option.click()
  // Výběr dopravy sám posune na krok Platba; tlačítko „Pokračovat" je jen
  // u voleb, které potřebují doplnit (výdejna apod.).
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    if (/step=payment/.test(page.url())) break
    const submit = page.getByTestId("submit-delivery-option-button")
    if ((await submit.isVisible().catch(() => false)) && !(await submit.isDisabled().catch(() => true))) {
      await submit.click().catch(() => {})
    }
    await sleep(500)
  }
  await page.waitForURL(/step=payment/, { timeout: 30000 })
  await page.waitForLoadState("networkidle").catch(() => {})
}

async function chooseComgateCard(page) {
  const card = page.locator('button[data-group="card"]').first()
  await card.waitFor({ timeout: 90000 })
  await card.click()
  // Víc karet → rozbalí se seznam; jedna karta → rovnou vybraná.
  const confirm = page.getByTestId("confirm-comgate-payment-button")
  if (!(await confirm.isVisible().catch(() => false))) {
    const firstMethod = page.locator('[class*="method"] button, [role="listbox"] button').first()
    if (await firstMethod.isVisible().catch(() => false)) await firstMethod.click()
  }
  await confirm.waitFor({ timeout: 60000 })
  await confirm.click()
  await page.waitForURL(/step=review/, { timeout: 120000 })
  await page.getByTestId("pre-contract-info").waitFor({ timeout: 90000 })
}

/** Na stránce makety ComGate „zaplatit“ a počkat na potvrzení objednávky. */
async function payInComgateMock(page, nameBase) {
  await page.waitForURL(/comgate\.sandbox\.test\/pay\//, { timeout: 120000 })
  const transId = (await page.getByTestId("comgate-trans-id").textContent())?.trim()
  const amount = (await page.getByTestId("comgate-amount").textContent())?.trim()
  const gateShot = await shot(page, `${nameBase}-comgate-gateway`)
  const t0 = Date.now()
  await page.getByTestId("comgate-pay").click()
  await page.waitForURL(/\/order\/order_[A-Z0-9]+\/confirmed/i, { timeout: 180000 })
  const orderId = page.url().match(/order\/(order_[A-Z0-9]+)/i)?.[1]
  await page.waitForLoadState("networkidle").catch(() => {})
  const confirmedShot = await shot(page, `${nameBase}-order-confirmed`)
  return { transId, amount, orderId, gateShot, confirmedShot, ms_from_pay_to_confirmed: Date.now() - t0 }
}

async function comgateTransaction(transId) {
  const { data: state } = await httpJson("GET", `${MAIL_URL}/comgate/_list`)
  const t = state.transactions?.[transId]
  return t
    ? { transId, status: t.status, price_minor: t.price, curr: t.curr, refId: t.refId, method: t.method, notifications: t.notifications ?? [] }
    : null
}

async function orderDetails(orderId) {
  const admin = await adminApi()
  const { order } = await admin.get(
    `/admin/orders/${orderId}?fields=id,display_id,email,created_at,currency_code,total,status,payment_status,fulfillment_status,metadata,*items,items.metadata,*shipping_methods,*payment_collections,*payment_collections.payments`
  )
  return {
    id: order.id,
    display_id: order.display_id,
    email: order.email,
    created_at: order.created_at,
    total: order.total,
    currency_code: order.currency_code,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    metadata: order.metadata,
    items: order.items.map((i) => ({ title: i.title, quantity: i.quantity, unit_price: i.unit_price, metadata: i.metadata })),
    shipping_methods: order.shipping_methods?.map((s) => ({ name: s.name, amount: s.amount })),
    payments: order.payment_collections?.map((pc) => ({
      amount: pc.amount,
      status: pc.status,
      payments: pc.payments?.map((p) => ({ provider_id: p.provider_id, amount: p.amount, captured_at: p.captured_at })),
    })),
  }
}

async function mailsFor(since, { settleMs = 8000 } = {}) {
  await sleep(settleMs)
  const notes = await notificationsSince(since)
  return notes.map((n) => ({
    template: n.template,
    channel: n.channel,
    to: n.to,
    status: n.status,
    subject: n.subject,
    mail_file: n.mail_file,
    attachments: (n.mail_attachments || []).map((a) => ({ filename: a.filename, bytes: a.bytes, is_pdf: a.is_pdf, fetch_status: a.fetch_status })),
    data_attachments: n.data_attachments,
  }))
}

function mailHtml(mailFile) {
  if (!mailFile) return ""
  try {
    return fs.readFileSync(path.join(MAIL_DIR, mailFile.replace(/\.json$/, ".html")), "utf8")
  } catch {
    return ""
  }
}

function htmlText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

async function buttonInfo(locator) {
  // Text, jak ho čte čtečka / jak ho vidí zákazník: bez prvků aria-hidden
  // (dekorativní šipky, duplikát popisku pro animaci výplně).
  return locator.evaluate((el) => {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return {
      text: clone.textContent.replace(/\s+/g, " ").trim(),
      raw_text_content: el.textContent.replace(/\s+/g, " ").trim(),
      disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
    }
  })
}

async function backendLogSince(sinceMs, pattern) {
  try {
    const text = fs.readFileSync(path.join(path.dirname(MAIL_DIR), ".logs", "backend.log"), "utf8")
    return text
      .split(/\r?\n/)
      .filter((l) => pattern.test(l))
      .map((l) => l.replace(/\u001b\[[0-9;]*m/g, "").trim())
      .slice(-40)
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* Scénáře                                                             */
/* ------------------------------------------------------------------ */

const scenarios = {}

scenarios.cookies = async () => {
  const { ctx, page, external, requests } = await newContext({ consent: false })
  try {
    await goto(page, "/cz")
    const banner = page.locator("aside").filter({ hasText: "Nezbytné cookies" }).first()
    await banner.waitFor({ timeout: 60000 })
    await sleep(1500)
    const buttons = await banner.locator("button").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return {
          text: el.textContent.trim(),
          width: Math.round(r.width),
          height: Math.round(r.height),
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          fontFamily: s.fontFamily.split(",")[0],
          color: s.color,
          background: s.backgroundColor,
          border: s.borderTopWidth + " " + s.borderTopStyle + " " + s.borderTopColor,
        }
      })
    )
    const bannerShot = await shot(page, "cookies-banner", { fullPage: false })
    const beforeConsentExternal = [...external]
    const googleBefore = requests.filter((r) => /google|gtag|doubleclick|googletagmanager|google-analytics/i.test(r.host))
    // Projít pár stránek bez rozhodnutí
    await goto(page, "/cz/store")
    await goto(page, "/cz/kurzy")
    const googleWhileUndecided = requests.filter((r) => /google|gtag|doubleclick|googletagmanager|google-analytics/i.test(r.host))
    await page.getByRole("button", { name: "Odmítnout vše" }).first().click()
    await sleep(1000)
    const bannerGone = !(await banner.isVisible().catch(() => false))
    await goto(page, "/cz")
    const googleAfterDeny = requests.filter((r) => /google|gtag|doubleclick|googletagmanager|google-analytics/i.test(r.host))
    const consentCookie = (await ctx.cookies(STOREFRONT_URL)).find((c) => c.name === "kz-cookie-consent")
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean))
    return {
      ok:
        buttons.length === 3 &&
        new Set(buttons.map((b) => `${b.height}|${b.fontSize}|${b.fontWeight}|${b.fontFamily}`)).size === 1 &&
        googleWhileUndecided.length === 0 &&
        googleAfterDeny.length === 0,
      buttons,
      equal_style: new Set(buttons.map((b) => `${b.height}|${b.fontSize}|${b.fontWeight}|${b.fontFamily}`)).size === 1,
      google_requests_before_consent: googleBefore,
      google_requests_while_undecided: googleWhileUndecided,
      google_requests_after_deny: googleAfterDeny,
      external_requests_before_consent: beforeConsentExternal,
      external_requests_total: external,
      banner_gone_after_deny: bannerGone,
      consent_cookie_after_deny: consentCookie ? decodeURIComponent(consentCookie.value) : null,
      script_srcs_after_deny: scripts.filter((s) => !s.startsWith(STOREFRONT_URL)),
      screenshots: [bannerShot].filter(Boolean),
    }
  } finally {
    await ctx.close()
  }
}

scenarios.a = async () => {
  const since = new Date().toISOString()
  const email = `e2e-a+${Date.now()}@sandbox.test`
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    await addToCart(page, "sandbox-miska-zahrada")
    await fillAddress(page, { email })
    await chooseDelivery(page, "Česká pošta — na adresu")
    await chooseComgateCard(page)

    const review = {}
    const pre = page.getByTestId("pre-contract-info")
    shots.push(await shot(page, "a-review-full"))
    shots.push(await shot(page, "a-pre-contract-info", { locator: pre }))
    review.pre_contract_text = (await pre.innerText()).replace(/\n+/g, " | ").slice(0, 2500)
    const terms = page.getByTestId("terms-checkbox")
    review.terms_checkbox_initially_checked = await terms.isChecked()
    const submit = page.getByTestId("submit-order-button")
    review.button_before_consent = await buttonInfo(submit)
    review.submit_note = (await page.getByTestId("submit-order-note").textContent().catch(() => ""))?.trim()
    review.consent_label = (await page.locator('label[for]').filter({ hasText: /obchodními podmínkami/ }).first().innerText().catch(() => "")).trim()
    await terms.check()
    review.button_after_consent = await buttonInfo(submit)
    shots.push(await shot(page, "a-review-consented", { locator: page.locator("main").first() }))
    await submit.click()

    const pay = await payInComgateMock(page, "a")
    shots.push(pay.gateShot, pay.confirmedShot)
    const comgate = await comgateTransaction(pay.transId)
    const order = await orderDetails(pay.orderId)
    const mails = await mailsFor(since)
    const webhookLog = (await backendLogSince(0, /\[comgate\] /)).filter(
      (l) => l.includes(pay.transId) || (comgate?.refId && l.includes(comgate.refId))
    )
    return {
      ok:
        review.terms_checkbox_initially_checked === false &&
        review.button_before_consent.disabled === true &&
        review.button_after_consent.text === ORDER_BUTTON &&
        comgate?.notifications?.[0]?.status === 200,
      email,
      review,
      payment: { ...pay, comgate },
      webhook_completed_immediately: comgate?.notifications?.[0]?.status === 200,
      webhook_backend_log: webhookLog.slice(-3),
      order,
      mails,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "a-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

scenarios.b = async () => {
  const since = new Date().toISOString()
  const email = `e2e-b+${Date.now()}@sandbox.test`
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    await addToCart(page, "sandbox-kvetinac-na-zakazku")
    await fillAddress(page, { email })
    const deliveryOptions = await page.getByTestId("delivery-option-radio").evaluateAll((els) =>
      els.map((el) => ({ text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 80), disabled: el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled") }))
    )
    shots.push(await shot(page, "b-delivery-options"))
    await chooseDelivery(page, "Osobní odběr v ateliéru")
    const paymentStep = {}
    await page.getByTestId("production-payment-mode").waitFor({ timeout: 60000 })
    paymentStep.deposit_amount_shown = (await page.getByTestId("production-payment-amount").textContent())?.trim()
    paymentStep.non_card_tiles = await page.locator('[data-testid^="payment-option-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))
    shots.push(await shot(page, "b-payment-step"))
    await chooseComgateCard(page)

    const review = {}
    const submit = page.getByTestId("submit-order-button")
    const terms = page.getByTestId("terms-checkbox")
    const mto = page.getByTestId("made-to-order-checkbox")
    review.terms_initially_checked = await terms.isChecked()
    review.mto_initially_checked = await mto.isChecked()
    review.button_initial = await buttonInfo(submit)
    review.gate_hint_initial = (await page.getByText(/výroba na míru|Potvrďte prosím/).first().textContent().catch(() => ""))?.trim()
    review.mto_label = (await page.locator("label").filter({ hasText: /na zakázku/ }).first().innerText().catch(() => "")).trim()
    review.pre_contract_withdrawal = (await page.getByTestId("pre-contract-withdrawal").innerText().catch(() => "")).trim()
    shots.push(await shot(page, "b-review-initial"))

    // Zadání (brief) — automatické ukládání
    const note = page.locator('[data-testid="commission-note-input"]:visible').first()
    await note.fill("Květináč cca 30 cm, zelená glazura, motiv listů (e2e sandbox).")
    await note.blur()
    await page.getByTestId("commission-status").filter({ hasText: /Uložen/ }).first().waitFor({ timeout: 60000 }).catch(() => {})
    await page.waitForLoadState("networkidle").catch(() => {})
    await sleep(1500)
    await terms.check()
    review.button_terms_only = await buttonInfo(submit)
    review.gate_hint_terms_only = (await page.getByText(/Potvrďte prosím ještě/).first().textContent().catch(() => ""))?.trim()
    shots.push(await shot(page, "b-review-terms-only"))
    await mto.check()
    review.button_all = await buttonInfo(submit)
    review.submit_note = (await page.getByTestId("submit-order-note").textContent().catch(() => ""))?.trim()
    shots.push(await shot(page, "b-review-ready"))
    await submit.click()

    const pay = await payInComgateMock(page, "b")
    shots.push(pay.gateShot, pay.confirmedShot)
    const comgate = await comgateTransaction(pay.transId)
    const order = await orderDetails(pay.orderId)
    const mails = await mailsFor(since)
    return {
      ok:
        review.mto_initially_checked === false &&
        review.button_terms_only.disabled === true &&
        review.button_all.disabled === false &&
        review.button_all.text === ORDER_BUTTON &&
        Boolean(order.metadata?.made_to_order_ack_at),
      email,
      delivery_options: deliveryOptions,
      payment_step: paymentStep,
      review,
      payment: { ...pay, comgate },
      order,
      mails,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "b-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

scenarios.c = async () => {
  const since = new Date().toISOString()
  const email = `e2e-c+${Date.now()}@sandbox.test`
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  const state = seedState()
  try {
    await goto(page, "/cz/products/sandbox-darkovy-poukaz")
    await page.getByTestId("voucher-amount").waitFor()
    shots.push(await shot(page, "c-voucher-product"))
    // Neplatná částka → hláška
    const input = page.getByTestId("voucher-amount-input")
    await input.fill("1550")
    await input.blur()
    await sleep(500)
    const invalidMessage = (await page.getByTestId("voucher-amount").innerText()).replace(/\n+/g, " | ")
    shots.push(await shot(page, "c-voucher-invalid", { locator: page.getByTestId("voucher-amount") }))
    await addToCart(page, "sandbox-darkovy-poukaz", { voucherAmount: 1500 })
    const cartId = await cartIdFromCookies(ctx)
    const { cart } = await storeApi(state.publishable_key).get(`/store/carts/${cartId}?fields=*items,+items.metadata`)
    const cartLines = cart.items.map((i) => ({ title: i.title, unit_price: i.unit_price, quantity: i.quantity, metadata: i.metadata }))
    await goto(page, "/cz/cart")
    shots.push(await shot(page, "c-cart"))
    const cartText = (await page.locator("main").first().innerText()).replace(/\s+/g, " ")
    await fillAddress(page, { email })
    await chooseDelivery(page, "Česká pošta — na adresu")
    await chooseComgateCard(page)
    await page.getByTestId("terms-checkbox").check()
    const button = await buttonInfo(page.getByTestId("submit-order-button"))
    shots.push(await shot(page, "c-review"))
    await page.getByTestId("submit-order-button").click()
    const pay = await payInComgateMock(page, "c")
    shots.push(pay.gateShot, pay.confirmedShot)
    const order = await orderDetails(pay.orderId)
    const mails = await mailsFor(since)
    const voucherLine = cartLines.find((l) => /poukaz/i.test(l.title))
    return {
      ok: voucherLine?.unit_price === 1500 && /1\s?500/.test(cartText) && order.items.some((i) => i.unit_price === 1500),
      email,
      invalid_amount_message: invalidMessage,
      cart_id: cartId,
      cart_lines: cartLines,
      cart_page_shows_1500: /1\s?500/.test(cartText),
      button,
      payment: pay,
      order,
      mails,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "c-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

scenarios.d = async () => {
  const since = new Date().toISOString()
  const email = `e2e-d+${Date.now()}@sandbox.test`
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    await goto(page, "/cz/kurzy")
    await page.getByRole("button", { name: /Vybrat termín/ }).first().click()
    const modal = page.locator('[aria-labelledby="kurzy-modal-title"]').first()
    await modal.waitFor()
    // Seznam termínů (přepnout zobrazení, pokud je kalendář)
    const listToggle = modal.getByRole("button", { name: /Seznam|seznam/ }).first()
    if (await listToggle.isVisible().catch(() => false)) await listToggle.click().catch(() => {})
    const term = modal.locator(".kurzyModal__term").filter({ hasText: "Sandbox" }).first()
    await term.waitFor({ timeout: 60000 })
    await term.click()
    shots.push(await shot(page, "d-term-selected", { fullPage: false }))
    await modal.getByRole("button", { name: /Pokračovat na údaje/ }).click()
    await modal.locator('input[name="name"]').fill("Testovací Účastník")
    await modal.locator('input[name="email"]').fill(email)
    await modal.locator('.kurzyModal__fields input[type="tel"]').fill("777000222")
    await modal.getByRole("button", { name: /Pokračovat na platbu/ }).click()
    await modal.getByTestId("course-terms-checkbox").waitFor()
    await modal.locator('input[name="payment_method"][value="on_site"]').check()
    const submit = modal.getByTestId("course-submit-button")
    const checks = {
      terms_initially_checked: await modal.getByTestId("course-terms-checkbox").isChecked(),
      exception_initially_checked: await modal.getByTestId("course-exception-checkbox").isChecked(),
      photo_initially_checked: await modal.getByTestId("course-photo-checkbox").isChecked(),
      button_initial: await buttonInfo(submit),
      pay_note_initial: (await modal.locator(".kurzyModal__payNote").textContent())?.trim(),
      storno_text: (await modal.getByTestId("course-storno").innerText()).trim(),
    }
    await submit.scrollIntoViewIfNeeded()
    shots.push(await shot(page, "d-platba-unchecked", { fullPage: false }))
    await modal.getByTestId("course-terms-checkbox").check()
    checks.button_terms_only = await buttonInfo(submit)
    await modal.getByTestId("course-exception-checkbox").check()
    checks.button_ready = await buttonInfo(submit)
    checks.pay_note_ready = (await modal.locator(".kurzyModal__payNote").textContent())?.trim()
    await submit.scrollIntoViewIfNeeded()
    shots.push(await shot(page, "d-platba-ready", { fullPage: false }))
    await submit.click()
    await sleep(4000)
    await page.waitForLoadState("networkidle").catch(() => {})
    shots.push(await shot(page, "d-done", { fullPage: false }))
    const doneText = (await modal.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 800)
    const [reservation] = await sql(
      `select id, term_id, status, payment_method, party_size, name, email, consents, created_at from course_reservation where email = $1`,
      [email]
    )
    const mails = await mailsFor(since)
    return {
      ok:
        checks.terms_initially_checked === false &&
        checks.exception_initially_checked === false &&
        checks.photo_initially_checked === false &&
        checks.button_initial.disabled === true &&
        checks.button_terms_only.disabled === true &&
        checks.button_ready.disabled === false &&
        checks.button_ready.text.startsWith(COURSE_BUTTON) &&
        Boolean(reservation?.consents?.exception_ack),
      email,
      checks,
      done_text: doneText,
      reservation,
      mails,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "d-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

scenarios.e = async () => {
  const since = new Date().toISOString()
  const email = `e2e-e+${Date.now()}@sandbox.test`
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    await addToCart(page, "sandbox-miska-zahrada")
    await fillAddress(page, { email })
    await chooseDelivery(page, "Česká pošta — na adresu")
    const tile = page.getByTestId("payment-option-pp_dobirka_ceska-posta")
    await tile.waitFor({ timeout: 90000 })
    const tiles = await page.locator('[data-testid^="payment-option-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))
    await tile.click()
    await page.waitForLoadState("networkidle").catch(() => {})
    const toReview = page.getByTestId("submit-payment-button")
    await toReview.waitFor()
    for (let i = 0; i < 30 && (await toReview.isDisabled()); i++) await sleep(500)
    shots.push(await shot(page, "e-payment-step"))
    await toReview.click()
    await page.waitForURL(/step=review/, { timeout: 120000 })
    await page.getByTestId("pre-contract-info").waitFor()
    const review = {
      terms_initially_checked: await page.getByTestId("terms-checkbox").isChecked(),
      button_visible_before_consent: await page.getByTestId("submit-order-button").isVisible().catch(() => false),
      gate_hint_before_consent: (await page.getByText(/potvrďte prosím souhlas/i).first().textContent().catch(() => ""))?.trim(),
      pre_contract_payment: (await page.getByTestId("pre-contract-payment").innerText().catch(() => "")).trim(),
    }
    shots.push(await shot(page, "e-review-before-consent"))
    await page.getByTestId("terms-checkbox").check()
    const submit = page.getByTestId("submit-order-button")
    await submit.waitFor()
    review.button = await buttonInfo(submit)
    review.note_under_button = (await page.getByTestId("submit-order-note").textContent().catch(() => ""))?.trim()
    shots.push(await shot(page, "e-review-ready"))
    await submit.click()
    await page.waitForURL(/\/order\/order_[A-Z0-9]+\/confirmed/i, { timeout: 180000 })
    const orderId = page.url().match(/order\/(order_[A-Z0-9]+)/i)?.[1]
    await page.waitForLoadState("networkidle").catch(() => {})
    shots.push(await shot(page, "e-order-confirmed"))
    const order = await orderDetails(orderId)
    const mails = await mailsFor(since)
    return {
      ok: review.button.text === ORDER_BUTTON && Boolean(review.note_under_button) && order.payments?.[0]?.payments?.[0]?.provider_id === "pp_dobirka_ceska-posta",
      email,
      payment_tiles: tiles,
      review,
      order,
      mails,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "e-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

async function ensureExpressCustomer() {
  const state = seedState()
  const store = storeApi(state.publishable_key)
  const email = `e2e-f-${Date.now()}@sandbox.test`
  const password = "sandbox-customer-123"
  const { data: reg } = await httpJson("POST", `${BACKEND_URL}/auth/customer/emailpass/register`, { email, password })
  const created = await httpJson(
    "POST",
    `${BACKEND_URL}/store/customers`,
    { email, first_name: "Expres", last_name: "Zákazník", phone: "+420777000333" },
    { "x-publishable-api-key": state.publishable_key, authorization: `Bearer ${reg.token}` }
  )
  const { data: login } = await httpJson("POST", `${BACKEND_URL}/auth/customer/emailpass`, { email, password })
  const auth = { "x-publishable-api-key": state.publishable_key, authorization: `Bearer ${login.token}` }
  const { data: addr } = await httpJson(
    "POST",
    `${BACKEND_URL}/store/customers/me/addresses`,
    {
      first_name: "Expres",
      last_name: "Zákazník",
      address_1: "Expresní 5",
      city: "Písek",
      postal_code: "39701",
      country_code: "cz",
      phone: "+420777000333",
      is_default_shipping: true,
      is_default_billing: true,
    },
    auth
  )
  void store
  if (!login?.token || created.status >= 300) throw new Error(`zákazník se nezaložil: ${JSON.stringify(created.data).slice(0, 300)}`)
  return { email, password, token: login.token, address_id: addr?.customer?.addresses?.[0]?.id ?? null }
}

scenarios.f = async () => {
  const since = new Date().toISOString()
  const customer = await ensureExpressCustomer()
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    await ctx.addCookies([{ name: "_medusa_jwt", value: customer.token, domain: "localhost", path: "/", httpOnly: true }])
    await goto(page, "/cz/products/sandbox-miska-zahrada")
    const buyNow = page.getByTestId("buy-now-button")
    await buyNow.waitFor({ timeout: 60000 })
    shots.push(await shot(page, "f-product-buy-now"))
    await buyNow.click()
    await page.waitForURL(/express-checkout/, { timeout: 120000 })
    await page.waitForLoadState("networkidle").catch(() => {})
    const terms = page.getByTestId("express-terms-checkbox")
    await terms.waitFor({ timeout: 90000 })
    const card = page.locator('button[data-group="card"]').first()
    if (await card.isVisible().catch(() => false)) await card.click()
    const confirm = page.getByTestId("confirm-comgate-payment-button")
    await confirm.waitFor({ timeout: 60000 })
    const review = {
      terms_initially_checked: await terms.isChecked(),
      button_before_consent: await buttonInfo(confirm),
      note: (await page.getByTestId("express-submit-note").textContent().catch(() => ""))?.trim(),
    }
    shots.push(await shot(page, "f-express-before-consent"))
    await terms.check()
    review.button_after_consent = await buttonInfo(confirm)
    shots.push(await shot(page, "f-express-ready"))
    await confirm.click()
    await page.waitForURL(/comgate\.sandbox\.test\/pay\//, { timeout: 120000 })
    const transId = (await page.getByTestId("comgate-trans-id").textContent())?.trim()
    shots.push(await shot(page, "f-comgate-gateway"))
    await page.getByTestId("comgate-pay").click()
    await page.waitForURL((u) => !/comgate\.sandbox\.test/.test(u.href), { timeout: 120000 })
    await page.waitForLoadState("networkidle").catch(() => {})
    await sleep(5000)
    shots.push(await shot(page, "f-after-payment"))
    const comgate = await comgateTransaction(transId)
    const [row] = await sql(`select id from "order" where email = $1 order by created_at desc limit 1`, [customer.email])
    const order = row ? await orderDetails(row.id) : null
    const mails = await mailsFor(since)
    return {
      ok: review.button_after_consent.text === ORDER_BUTTON && review.button_before_consent.disabled === true && Boolean(order),
      customer: { email: customer.email },
      review,
      landing_url: page.url(),
      payment: { transId, comgate },
      order,
      mails,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "f-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

/** Odeslat + doručit objednávku přes admin API (nativní fulfillment). */
async function shipAndDeliver(orderId, { deliver = true } = {}) {
  const admin = await adminApi()
  const state = seedState()
  const load = async () =>
    (
      await admin.get(
        `/admin/orders/${orderId}?fields=id,*items,items.requires_shipping,items.detail.fulfilled_quantity,*fulfillments,fulfillments.requires_shipping,fulfillments.shipped_at`
      )
    ).order
  const order = await load()
  // Medusa neumí jedno plnění se zbožím k odeslání i bez odeslání (balné,
  // doběrečné) — dvě plnění, jako v adminu. Už splněné řádky se přeskočí.
  const open = (ship) =>
    order.items
      .filter((i) => Boolean(i.requires_shipping) === ship)
      .map((i) => ({ id: i.id, quantity: Number(i.quantity) - Number(i.detail?.fulfilled_quantity ?? 0) }))
      .filter((i) => i.quantity > 0)
  const steps = []
  const service = open(false)
  if (service.length) {
    await admin.post(`/admin/orders/${orderId}/fulfillments`, { items: service, location_id: state.stock_location_id })
    steps.push({ step: "fulfillment (bez odeslání: balné/doběrečné)", items: service.length })
  }
  const items = open(true)
  const before = new Set((order.fulfillments ?? []).map((f) => f.id))
  if (items.length) {
    await admin.post(`/admin/orders/${orderId}/fulfillments`, { items, location_id: state.stock_location_id })
  }
  const after = await load()
  const fulfillment =
    (after.fulfillments ?? []).filter((x) => !before.has(x.id)).find((x) => x.requires_shipping !== false) ??
    (after.fulfillments ?? []).find((x) => x.requires_shipping !== false && !x.shipped_at)
  if (!fulfillment) throw new Error(`Plnění se zbožím k odeslání nevzniklo: ${JSON.stringify(after.fulfillments)}`)
  steps.push({ step: "fulfillment (zboží)", id: fulfillment.id, items: items.length })
  await admin.post(`/admin/orders/${orderId}/fulfillments/${fulfillment.id}/shipments`, { items, labels: [] })
  steps.push({ step: "shipment", at: new Date().toISOString() })
  if (deliver) {
    await admin.post(`/admin/orders/${orderId}/fulfillments/${fulfillment.id}/mark-as-delivered`, {})
    steps.push({ step: "delivered", at: new Date().toISOString() })
  }
  return steps
}

function findLink(mails, pattern) {
  for (const m of mails) {
    const html = mailHtml(m.mail_file)
    const hit = html.match(pattern)
    if (hit) return { url: hit[0].replace(/&amp;/g, "&"), template: m.template, subject: m.subject }
  }
  return null
}

scenarios.withdrawal = async (results) => {
  const orderId = results.a?.order?.id
  if (!orderId) throw new Error("Chybí objednávka ze scénáře a — spusťte nejdřív „a“.")
  const since = new Date().toISOString()
  const shipping = await shipAndDeliver(orderId)
  const shipMails = await mailsFor(since, { settleMs: 10000 })
  const allMails = [...shipMails, ...(results.a.mails ?? [])]
  const link =
    findLink(shipMails, /http:\/\/localhost:8100\/[a-z]{2}\/order\/[^"'\s<>]+\/odstoupeni\?token=[^"'\s<>]+/) ||
    findLink(allMails, /http:\/\/localhost:8100\/[a-z]{2}\/order\/[^"'\s<>]+\/odstoupeni\?token=[^"'\s<>]+/)
  if (!link) throw new Error("V zachycených e-mailech není odkaz na odstoupení (/odstoupeni?token=).")

  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    const since2 = new Date().toISOString()
    await page.goto(link.url, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    await page.getByRole("button", { name: "Pokračovat ke kontrole" }).waitFor({ timeout: 90000 })
    const step1Text = (await page.locator("main").first().innerText()).replace(/\s+/g, " ").slice(0, 2500)
    shots.push(await shot(page, "withdrawal-step1"))
    await page.getByRole("button", { name: "Pokračovat ke kontrole" }).click()
    await page.getByRole("button", { name: "Potvrdit odstoupení od smlouvy" }).waitFor()
    const step2Text = (await page.locator("main").first().innerText()).replace(/\s+/g, " ").slice(0, 2500)
    shots.push(await shot(page, "withdrawal-step2"))
    await page.getByRole("button", { name: "Potvrdit odstoupení od smlouvy" }).click()
    await page.getByText("Odstoupení od smlouvy jsme přijali.").waitFor({ timeout: 90000 })
    const doneText = (await page.locator("main").first().innerText()).replace(/\s+/g, " ").slice(0, 2500)
    shots.push(await shot(page, "withdrawal-done"))
    const mails = await mailsFor(since2, { settleMs: 10000 })
    const confirmMail = mails.find((m) => m.to === results.a.email && /odstoup/i.test(m.subject ?? ""))
    const confirmText = htmlText(mailHtml(confirmMail?.mail_file))
    const rows = await sql(
      `select id, kind, status, channel, submitted_at, takeover_at, withdrawal_deadline, created_at, items, line_items, refund_method, requested_resolution
         from return_request where order_id = $1 order by created_at desc`,
      [orderId]
    )
    const dateTime = confirmText.match(/\d{1,2}\.\s?\d{1,2}\.\s?\d{4}[^0-9]{1,12}\d{1,2}:\d{2}/)
    return {
      ok: Boolean(confirmMail) && Boolean(dateTime) && rows.length > 0,
      order_id: orderId,
      shipping_via_admin: shipping,
      shipment_mails: shipMails,
      link_used: { ...link, url: link.url.replace(/token=[^&]+/, "token=…") },
      step1_text: step1Text,
      step2_text: step2Text,
      done_text: doneText,
      confirmation_mail: confirmMail,
      confirmation_mail_has_date_time: dateTime?.[0] ?? null,
      confirmation_mail_text: confirmText.slice(0, 3000),
      mails,
      return_request: rows,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "withdrawal-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

/** Objednávka přes Store API (ComGate maketa) pro reklamaci. */
async function apiOrderForComplaint() {
  const { execFileSync } = await import("node:child_process")
  const out = execFileSync(process.execPath, ["smoke-order.mjs", "--provider=comgate", "--shipping=cz_address", `--email=e2e-reklamace+${Date.now()}@sandbox.test`], {
    cwd: SANDBOX_DIR,
    encoding: "utf8",
  })
  const orderId = out.match(/OBJEDNÁVKA (order_[A-Z0-9]+)/)?.[1]
  if (!orderId) throw new Error(`smoke-order nevrátil objednávku:\n${out.slice(-800)}`)
  return orderId
}

scenarios.complaint = async () => {
  const sinceOrder = new Date().toISOString()
  const orderId = await apiOrderForComplaint()
  const orderMails = await mailsFor(sinceOrder, { settleMs: 6000 })
  const since = new Date().toISOString()
  const shipping = await shipAndDeliver(orderId)
  const shipMails = await mailsFor(since, { settleMs: 10000 })
  const link =
    findLink([...shipMails, ...orderMails], /http:\/\/localhost:8100\/[a-z]{2}\/order\/[^"'\s<>]+\/refund\?token=[^"'\s<>&]+/) ||
    null
  if (!link) throw new Error("V e-mailech není odkaz /refund?token= pro reklamaci.")
  const url = `${link.url}&kind=reklamace`
  const { ctx, page, external, consoleErrors } = await newContext()
  const shots = []
  try {
    const since2 = new Date().toISOString()
    await page.goto(url, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    await page.locator('input[name="refund-kind"][value="reklamace"]').check().catch(() => {})
    // Položka (výrobek, ne balné)
    const itemBox = page.locator("label").filter({ hasText: "Sandbox — Miska Zahrada" }).locator('input[type="checkbox"]').first()
    if ((await itemBox.count()) && !(await itemBox.isChecked())) await itemBox.check()
    await page.locator('input[name="requested-resolution"][value="replace"]').check()
    await page.locator('input[name="damage-cause"][value="defect"]').check()
    await page.locator("textarea").first().fill("Miska má prasklinu u okraje, všimla jsem si hned po rozbalení. (e2e sandbox)")
    shots.push(await shot(page, "complaint-form"))
    const send = page.getByRole("button", { name: "Odeslat žádost" })
    await send.click()
    await page.waitForURL(/\/claims\?token=/, { timeout: 120000 })
    await page.waitForLoadState("networkidle").catch(() => {})
    shots.push(await shot(page, "complaint-status"))
    const statusText = (await page.locator("main").first().innerText()).replace(/\s+/g, " ").slice(0, 2000)
    const mails = await mailsFor(since2, { settleMs: 10000 })
    const receipt = mails.find((m) => m.template === "refund-request" && !/owner@|dev@/.test(m.to))
    const receiptText = htmlText(mailHtml(receipt?.mail_file))
    const rows = await sql(
      `select id, kind, status, channel, submitted_at, takeover_at, resolve_by, requested_resolution, damage_cause, reason, protocol_number, created_at
         from return_request where order_id = $1 order by created_at desc`,
      [orderId]
    )
    const dateTime = receiptText.match(/\d{1,2}\.\s?\d{1,2}\.\s?\d{4}[^0-9]{1,12}\d{1,2}:\d{2}/)
    return {
      ok: Boolean(receipt) && Boolean(dateTime) && /30 dn/.test(receiptText) && /výměn|nový kus/i.test(receiptText),
      order_id: orderId,
      shipping_via_admin: shipping,
      link_used: { ...link, url: link.url.replace(/token=[^&]+/, "token=…") + "&kind=reklamace" },
      status_page_text: statusText,
      receipt_mail: receipt,
      receipt_has_date_time: dateTime?.[0] ?? null,
      receipt_mentions_30_days: /30 dn/.test(receiptText),
      receipt_mentions_resolution: (receiptText.match(/[^.]{0,60}(výměn|nový kus|Požadujete|požadovan)[^.]{0,80}/i) || [null])[0],
      receipt_text: receiptText.slice(0, 3000),
      mails,
      return_request: rows,
      external_blocked: external,
      page_errors: consoleErrors,
      screenshots: shots.filter(Boolean),
    }
  } catch (e) {
    shots.push(await shot(page, "complaint-ERROR"))
    throw Object.assign(e, { screenshots: shots.filter(Boolean), url: page.url() })
  } finally {
    await ctx.close()
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const TITLES = {
  cookies: "4 · Lišta cookies při první návštěvě",
  a: "1a · Běžný výrobek → ComGate (maketa)",
  b: "1b · Výrobek na zakázku → záloha ComGate",
  c: "1c · Dárkový poukaz s vlastní částkou",
  d: "1d · Rezervace kurzu (RezervaceModal), platba na místě",
  e: "1e · Dobírka (CZ, Česká pošta na adresu)",
  f: "1f · Koupit ihned (express checkout)",
  withdrawal: "2 · Online odstoupení od smlouvy (§ 1830a) — objednávka z 1a",
  complaint: "3 · Reklamace a potvrzení o přijetí",
}

function mailTable(mails = []) {
  if (!mails.length) return "_žádné_\n"
  const rows = mails.map((m) => {
    const atts = (m.attachments || []).map((a) => `${a.filename} (${a.bytes ?? "?"} B${a.is_pdf ? ", PDF" : ""})`).join("<br>")
    return `| ${m.channel} | \`${m.template}\` | ${m.to || "—"} | ${m.subject ?? "—"} | ${atts || "—"} | ${m.status} |`
  })
  return ["| kanál | šablona | komu | předmět | přílohy | stav |", "|---|---|---|---|---|---|", ...rows].join("\n") + "\n"
}

function shotsList(r) {
  return (r.screenshots || []).map((s) => `- [${path.basename(s)}](${s})`).join("\n")
}

function json(v) {
  return "```json\n" + JSON.stringify(v, null, 2) + "\n```\n"
}

export function writeReport(results) {
  const out = []
  out.push("# Sandbox — testovací objednávky (WS-H, fáze 2)\n")
  out.push(`Vygenerováno: ${new Date().toISOString()} · storefront ${STOREFRONT_URL} · backend ${BACKEND_URL} · e-maily ${MAIL_URL}/\n`)
  out.push("Prohlížeč (Playwright Chromium) smí jen na localhost; `https://comgate.sandbox.test` → maketa ComGate. Všechny ostatní požadavky se blokují a jsou uvedené u scénáře.\n")
  out.push("| scénář | výsledek | id |\n|---|---|---|")
  for (const key of Object.keys(TITLES)) {
    const r = results[key]
    if (!r) continue
    const id = r.order?.id || r.reservation?.id || r.order_id || "—"
    out.push(`| ${TITLES[key]} | ${r.error ? "❌ CHYBA" : r.ok ? "✅ OK" : "⚠️ zkontrolovat"} | ${id} |`)
  }
  out.push("")
  for (const key of Object.keys(TITLES)) {
    const r = results[key]
    if (!r) continue
    out.push(`\n## ${TITLES[key]}\n`)
    out.push(`Běh: ${r.ran_at ?? "?"} · výsledek: **${r.error ? "CHYBA" : r.ok ? "OK" : "zkontrolovat"}**${r.legal_allow_draft ? " · běželo s `SANDBOX_LEGAL_ALLOW_DRAFT=1`" : ""}\n`)
    if (r.error) out.push("```\n" + r.error + "\n```\n")
    const { screenshots, mails, ...rest } = r
    if (key === "cookies") {
      out.push(json({
        buttons: r.buttons,
        equal_style: r.equal_style,
        google_requests_before_consent: r.google_requests_before_consent,
        google_requests_while_undecided: r.google_requests_while_undecided,
        google_requests_after_deny: r.google_requests_after_deny,
        external_requests_total: r.external_requests_total,
        banner_gone_after_deny: r.banner_gone_after_deny,
        consent_cookie_after_deny: r.consent_cookie_after_deny,
        script_srcs_after_deny: r.script_srcs_after_deny,
      }))
    } else {
      if (r.order) {
        out.push(`**Objednávka** ${r.order.id} (#${r.order.display_id}) · ${r.order.email} · celkem ${r.order.total} ${r.order.currency_code} · platba ${r.order.payment_status}\n`)
        out.push("`order.metadata`:\n")
        out.push(json(r.order.metadata))
        out.push("Položky / doprava / platby:\n")
        out.push(json({ items: r.order.items, shipping_methods: r.order.shipping_methods, payments: r.order.payments }))
      }
      if (r.reservation) {
        out.push(`**Rezervace** ${r.reservation.id} · ${r.reservation.email} · ${r.reservation.payment_method} · ${r.reservation.status}\n`)
        out.push("`consents`:\n")
        out.push(json(r.reservation.consents))
      }
      const detailKeys = Object.keys(rest).filter(
        (k) => !["ok", "order", "reservation", "external_blocked", "page_errors", "ran_at", "error"].includes(k)
      )
      if (detailKeys.length) {
        out.push("Podrobnosti:\n")
        out.push(json(Object.fromEntries(detailKeys.map((k) => [k, rest[k]]))))
      }
      out.push("**E-maily:**\n")
      out.push(mailTable(mails))
      if (r.external_blocked?.length) out.push(`Zablokované vnější požadavky prohlížeče: ${r.external_blocked.map((e) => e.url).join(", ")}\n`)
      if (r.page_errors?.length) out.push(`Chyby stránky (pageerror): ${r.page_errors.join(" · ")}\n`)
    }
    if (screenshots?.length) out.push("\n**Snímky:**\n\n" + shotsList(r) + "\n")
  }
  if (results._attachments_check) {
    out.push("\n## Kontrola příloh potvrzení objednávky (SANDBOX_LEGAL_ALLOW_DRAFT=1)\n")
    out.push(json(results._attachments_check))
  }
  if (results._notes?.length) {
    out.push("\n## Poznámky a nálezy\n")
    for (const n of results._notes) out.push(`- ${n}`)
  }
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "report.md"), out.join("\n") + "\n")
  log(`report → ${path.join(ARTIFACTS_DIR, "report.md")}`)
}

/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2)
  const results = loadResults()
  if (args[0] === "report") {
    writeReport(results)
    return
  }
  const order = ["cookies", "a", "b", "c", "d", "e", "f", "withdrawal", "complaint"]
  const wanted = args.length ? args : order
  browser = await chromium.launch({ headless: true })
  try {
    for (const key of wanted) {
      if (!scenarios[key]) {
        log(`neznámý scénář ${key}`)
        continue
      }
      log(`▶ ${TITLES[key] ?? key}`)
      const t0 = Date.now()
      try {
        const r = await scenarios[key](results)
        results[key] = { ...r, ran_at: new Date().toISOString(), duration_s: Math.round((Date.now() - t0) / 1000), legal_allow_draft: process.env.SANDBOX_LEGAL_ALLOW_DRAFT === "1" }
        log(`  ${r.ok ? "OK" : "ZKONTROLOVAT"} (${results[key].duration_s} s)`)
      } catch (e) {
        results[key] = { ok: false, error: `${e?.message || e}${e?.url ? `\n(URL: ${e.url})` : ""}`, screenshots: e?.screenshots, ran_at: new Date().toISOString() }
        log(`  CHYBA: ${e?.message || e}`)
      }
      saveResults(results)
    }
  } finally {
    await browser.close()
  }
  writeReport(results)
}

main().catch((e) => {
  console.error("[e2e] CHYBA:", e)
  process.exitCode = 1
})
