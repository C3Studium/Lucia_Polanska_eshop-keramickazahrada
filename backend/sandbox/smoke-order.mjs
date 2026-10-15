#!/usr/bin/env node
// Kouřový test: objednávka přes Store API stejnou cestou jako storefront,
// pak výpis order.metadata a zachycených e-mailů.
//
//   node smoke-order.mjs [--product=regular|made_to_order|voucher_fixed|voucher_custom]
//                        [--shipping=pickup|cz_address|cz_fragile|cz_balikovna|sk_address|sk_fragile]
//                        [--provider=pickup|system|comgate|dobirka] [--country=cz|sk]
//                        [--email=zakaznik@sandbox.test] [--voucher-amount=1500]
//
// Výchozí: běžný výrobek, osobní odběr, „Zaplatím při vyzvednutí“ (pp_osobni-odber_pickup), CZ.
// Výsledek: .artifacts/smoke-<order>.json + výpis do konzole.
import fs from "node:fs"
import path from "node:path"

import { ARTIFACTS_DIR, MAIL_URL } from "./lib/config.mjs"
import { adminApi, notificationsSince, postLocal, seedState, storeApi, waitForMails } from "./lib/api.mjs"

const arg = (name, def) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : def
}

const PROVIDERS = {
  pickup: "pp_osobni-odber_pickup",
  system: "pp_system_default",
  comgate: "pp_comgate_comgate",
  dobirka: "pp_dobirka_ceska-posta",
}

const productKey = arg("product", "regular")
const shippingKey = arg("shipping", "pickup")
const providerKey = arg("provider", "pickup")
const country = arg("country", shippingKey.startsWith("sk_") ? "sk" : "cz")
const email = arg("email", `zakaznik+${Date.now()}@sandbox.test`)
const voucherAmount = Number(arg("voucher-amount", "1500"))
// Verze právních dokumentů, jak je zapisuje storefront (recordCheckoutConsent).
const termsVersion = arg("terms-version", "2026-10-15")

const log = (...a) => console.log("[smoke]", ...a)

async function main() {
  const state = seedState()
  const store = storeApi(state.publishable_key)
  const startedAt = new Date().toISOString()
  const product = state.products[productKey]
  if (!product) throw new Error(`Neznámý produkt ${productKey}`)
  const providerId = PROVIDERS[providerKey]
  if (!providerId) throw new Error(`Neznámý poskytovatel ${providerKey}`)

  // 1) Košík v regionu (storefront: POST /store/carts {region_id})
  const { cart: created } = await store.post("/store/carts", { region_id: state.regions[country] })
  const cartId = created.id
  log(`košík ${cartId} (${country}, ${created.currency_code})`)

  // 2) Položka přes vlastní route jako storefront (line-items-custom)
  const itemMetadata =
    productKey === "made_to_order"
      ? { made_to_order: { specification: "" } }
      : productKey === "voucher_custom"
        ? { voucher_amount: voucherAmount }
        : {}
  await store.post(`/store/carts/${cartId}/line-items-custom`, {
    variant_id: product.variant_id,
    quantity: 1,
    metadata: itemMetadata,
  })
  log(`položka ${productKey} (${product.handle}) přidána`)

  // 3) Adresa + e-mail
  const address = {
    first_name: "Testovací",
    last_name: "Zákazník",
    address_1: country === "sk" ? "Hlavná 1" : "Testovací 12",
    address_2: "",
    company: "",
    postal_code: country === "sk" ? "811 01" : "397 01",
    city: country === "sk" ? "Bratislava" : "Písek",
    country_code: country,
    province: "",
    phone: "+420777000111",
  }
  await store.post(`/store/carts/${cartId}`, { email, shipping_address: address, billing_address: address })
  log(`adresa + e-mail ${email}`)

  // 3b) Zakázka: zadání do metadat položky (storefront: saveCommissionBrief)
  if (productKey === "made_to_order") {
    const { cart } = await store.get(`/store/carts/${cartId}?fields=*items`)
    const line = cart.items.find((i) => i.variant_id === product.variant_id)
    await store.post(`/store/carts/${cartId}/line-items/${line.id}`, {
      quantity: 1,
      metadata: {
        made_to_order: {
          specification: "Květináč 30 cm, glazura zelená, motiv listů. (sandbox smoke)",
          note: "Fotka místa by byla v příloze.",
        },
      },
    })
    log("zadání zakázky uloženo")
  }

  // 4) Doprava
  const { shipping_options } = await store.get(
    `/store/shipping-options?cart_id=${cartId}&fields=+service_zone.fulfillment_set.type`
  )
  const wantedId = state.shipping_options[shippingKey]
  const option = shipping_options.find((o) => o.id === wantedId)
  if (!option) {
    throw new Error(
      `Doprava ${shippingKey} (${wantedId}) není pro košík k dispozici. Nabídka: ${shipping_options.map((o) => o.name).join(", ")}`
    )
  }
  await store.post(`/store/carts/${cartId}/shipping-methods`, { option_id: option.id })
  log(`doprava „${option.name}“`)

  // 5) Zakázka: režim platby (záloha) + platební kolekce na zálohu
  const madeToOrder = productKey === "made_to_order"
  const consent = {
    terms_version: termsVersion,
    terms_accepted_at: new Date().toISOString(),
    withdrawal_info_version: termsVersion,
    privacy_version: termsVersion,
    made_to_order_ack_at: madeToOrder ? new Date().toISOString() : "",
    made_to_order_ack_version: madeToOrder ? termsVersion : "",
  }
  // U zakázky musí metadata jít PŘED kolekcí (každá úprava košíku kolekci zálohy přepočítá).
  if (madeToOrder) {
    await store.post(`/store/carts/${cartId}`, { metadata: consent })
    await store.post(`/store/carts/${cartId}/production-payment-mode`, { mode: "deposit" })
  }

  let paymentCollectionId
  if (madeToOrder) {
    const r = await store.post(`/store/carts/${cartId}/made-to-order-payment`, {})
    const p = r.payment ?? r
    paymentCollectionId = p.payment_collection_id
    log(`kolekce zálohy ${paymentCollectionId} (k úhradě teď ${p.payment_amount}, záloha ${p.deposit_amount ?? "?"})`)
  }
  if (!paymentCollectionId) {
    const { cart } = await store.get(`/store/carts/${cartId}?fields=+payment_collection.id`)
    paymentCollectionId = cart.payment_collection?.id
  }
  if (!paymentCollectionId) {
    const { payment_collection } = await store.post("/store/payment-collections", { cart_id: cartId })
    paymentCollectionId = payment_collection.id
  }

  // 6) Platební relace
  const sessionData =
    providerKey === "comgate"
      ? {
          cart_id: cartId,
          method: "CARD_CZ_CSOB_2",
          email,
          first_name: address.first_name,
          last_name: address.last_name,
          country_code: country.toUpperCase(),
          delivery: shippingKey === "pickup" ? "PICKUP" : "HOME_DELIVERY",
          lang: "cs",
        }
      : undefined
  const { payment_collection } = await store.post(`/store/payment-collections/${paymentCollectionId}/payment-sessions`, {
    provider_id: providerId,
    ...(sessionData ? { data: sessionData } : {}),
  })
  const session = payment_collection.payment_sessions.find((s) => s.provider_id === providerId)
  log(`platební relace ${session.id} (${providerId}, ${payment_collection.amount} ${payment_collection.currency_code})`)

  // 7) Souhlas jako storefront těsně před dokončením (běžný košík)
  if (!madeToOrder) await store.post(`/store/carts/${cartId}`, { metadata: consent })

  // 8) ComGate: zaplatit v maketě → oznámení do backendu dokončí košík
  let comgate = null
  if (providerKey === "comgate") {
    const transId = session.data?.transId
    comgate = (await postLocal(`${MAIL_URL}/comgate/_simulate/${transId}`, { status: "PAID" })).data
    log(`ComGate maketa: ${transId} → PAID, oznámení HTTP ${comgate.notification?.status}`)
  }

  // 9) Dokončení
  const completed = await store.post(`/store/carts/${cartId}/complete`, {})
  if (completed.type !== "order") throw new Error(`Košík se nedokončil: ${JSON.stringify(completed.error || completed)}`)
  const orderId = completed.order.id
  log(`OBJEDNÁVKA ${orderId} (#${completed.order.display_id})`)

  // 10) Co se uložilo (admin API)
  const admin = await adminApi()
  const { order } = await admin.get(
    `/admin/orders/${orderId}?fields=id,display_id,email,currency_code,total,metadata,*items,items.metadata,*shipping_methods,*payment_collections,*payment_collections.payments`
  )

  // 11) E-maily (subscribery běží asynchronně)
  await waitForMails({ since: startedAt, minCount: 1, quietMs: 8000, timeoutMs: 90000 })
  const notifications = await notificationsSince(startedAt)

  const result = {
    scenario: { product: productKey, shipping: shippingKey, provider: providerId, country, email },
    order: {
      id: order.id,
      display_id: order.display_id,
      email: order.email,
      currency_code: order.currency_code,
      total: order.total,
      metadata: order.metadata,
      items: order.items.map((i) => ({ title: i.title, quantity: i.quantity, unit_price: i.unit_price, metadata: i.metadata })),
      shipping_methods: order.shipping_methods?.map((s) => ({ name: s.name, amount: s.amount })),
      payments: order.payment_collections?.map((pc) => ({
        amount: pc.amount,
        status: pc.status,
        metadata: pc.metadata,
        payments: pc.payments?.map((p) => ({ provider_id: p.provider_id, amount: p.amount, captured_at: p.captured_at })),
      })),
    },
    comgate,
    notifications,
  }

  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
  const file = path.join(ARTIFACTS_DIR, `smoke-${order.display_id}-${productKey}-${providerKey}.json`)
  fs.writeFileSync(file, JSON.stringify(result, null, 2))

  console.log("\n===== order.metadata =====")
  console.log(JSON.stringify(order.metadata, null, 2))
  console.log("\n===== e-maily / notifikace =====")
  for (const n of notifications) {
    const atts = (n.mail_attachments || []).map((a) => `${a.filename} (${a.bytes ?? "nestaženo"} B${a.is_pdf ? ", PDF" : ""})`)
    console.log(
      `- [${n.channel}] ${n.template} → ${n.to} | ${n.status} | „${n.subject ?? "—"}“${atts.length ? ` | přílohy: ${atts.join(", ")}` : ""}${
        n.data_attachments ? ` | data.__attachments: ${JSON.stringify(n.data_attachments)}` : ""
      }`
    )
  }
  console.log(`\n[smoke] uloženo: ${file}`)
  console.log(`[smoke] e-maily: ${MAIL_URL}/`)
  return result
}

main().catch((e) => {
  console.error("[smoke] CHYBA:", e?.message || e)
  process.exitCode = 1
})
