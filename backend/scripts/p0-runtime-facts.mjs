/**
 * P0-1 / P0-4 — runtime facts collector (READ-ONLY).
 *
 * WorkflowPlan.md §24 Phase 0 requires runtime facts that cannot be derived from
 * source: how many stock locations exist, which shipping options map to which
 * fulfilment provider, whether a cash-on-delivery option exists (D1 says it must
 * not), whether made-to-order variants have `manage_inventory` disabled (P6-6),
 * and how many unshipped orders still use a Packeta shipping method (P4-5).
 *
 * This script performs ONE authentication call and then only HTTP GETs. It never
 * writes, and it prints no secrets. Output is a markdown block ready to be pasted
 * into `WorkflowPlan.md` as the `§0-notes` appendix.
 *
 * Usage (from `backend/`):
 *
 *   BACKEND_URL=https://backend-production-81e2.up.railway.app \
 *   ADMIN_EMAIL=you@example.com \
 *   ADMIN_PASSWORD='…' \
 *   node scripts/p0-runtime-facts.mjs
 *
 * Requires Node 20+ (global fetch).
 */

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/+$/, "")
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!BACKEND_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Missing env. Required: BACKEND_URL, ADMIN_EMAIL, ADMIN_PASSWORD.\n" +
      "See the header of this file for a usage example."
  )
  process.exit(1)
}

const authenticate = async () => {
  const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) {
    throw new Error(
      `Authentication failed (${res.status}). Check ADMIN_EMAIL / ADMIN_PASSWORD.`
    )
  }
  const body = await res.json()
  if (!body.token) {
    throw new Error("Authentication returned no token.")
  }
  return body.token
}

/** Every data-gathering call goes through here, so the script stays read-only. */
const get = async (token, path) => {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

/** Walks an offset-paginated admin list endpoint to completion. */
const getAll = async (token, path, key, pageSize = 100) => {
  const separator = path.includes("?") ? "&" : "?"
  const items = []
  let offset = 0
  for (;;) {
    const page = await get(
      token,
      `${path}${separator}limit=${pageSize}&offset=${offset}`
    )
    const batch = page[key] || []
    items.push(...batch)
    offset += pageSize
    if (batch.length < pageSize || offset >= (page.count ?? items.length)) {
      break
    }
  }
  return items
}

const looksLikeCod = (text) =>
  /\b(cod|dobirka|dobírka|dobirkou|dobírkou|cash.?on.?delivery)\b/i.test(
    text || ""
  )

const main = async () => {
  const token = await authenticate()
  const lines = []
  const out = (line = "") => lines.push(line)

  // ---- 1. Stock locations (the plan assumes exactly one workshop, §10) --------
  const stockLocations = await getAll(
    token,
    "/admin/stock-locations?fields=id,name",
    "stock_locations"
  )

  // ---- 2. Fulfilment providers actually registered at runtime ----------------
  const providers = await getAll(
    token,
    "/admin/fulfillment-providers",
    "fulfillment_providers"
  )

  // ---- 3. Shipping options ↔ provider ids, and COD detection ----------------
  const shippingOptions = await getAll(
    token,
    "/admin/shipping-options?fields=id,name,provider_id,shipping_profile_id,price_type,data",
    "shipping_options"
  )

  // ---- 4. Made-to-order products/variants: manage_inventory state (P6-6) -----
  const mtoProfiles = await getAll(
    token,
    "/admin/made-to-order/products",
    "products",
    50
  )

  // ---- 5. Unshipped orders on a Packeta shipping method (P4-5) ---------------
  const packetaOptionIds = new Set(
    shippingOptions
      .filter((option) => /packeta|zasilkovna|zásilkovna/i.test(
        `${option.provider_id} ${option.name}`
      ))
      .map((option) => option.id)
  )
  const orders = await getAll(
    token,
    "/admin/orders?order=-created_at&fields=id,display_id,status,fulfillment_status," +
      "payment_status,created_at,shipping_methods.id,shipping_methods.name," +
      "shipping_methods.shipping_option_id",
    "orders"
  )
  const usesPacketa = (order) =>
    (order.shipping_methods || []).some(
      (method) =>
        packetaOptionIds.has(method.shipping_option_id) ||
        /packeta|zasilkovna|zásilkovna/i.test(method.name || "")
    )
  const openPacketaOrders = orders.filter(
    (order) =>
      usesPacketa(order) &&
      order.status !== "canceled" &&
      !["shipped", "delivered"].includes(order.fulfillment_status)
  )

  // ---- Render ---------------------------------------------------------------
  out("## §0-notes — P0-1 / P0-4 runtime facts")
  out()
  out(`Collected ${new Date().toISOString().slice(0, 10)} against \`${BACKEND_URL}\` (read-only).`)
  out()

  out(`**Stock locations:** ${stockLocations.length}`)
  for (const location of stockLocations) {
    out(`- \`${location.id}\` — ${location.name}`)
  }
  out(
    stockLocations.length === 1
      ? "→ Single-workshop assumption (§10) holds."
      : "→ ⚠ Plan assumes exactly one location (§10). Deviation — report to Matěj."
  )
  out()

  out(`**Fulfilment providers registered:** ${providers.length}`)
  for (const provider of providers) {
    out(`- \`${provider.id}\`${provider.is_enabled === false ? " (disabled)" : ""}`)
  }
  out()

  out(`**Shipping options:** ${shippingOptions.length}`)
  for (const option of shippingOptions) {
    out(
      `- \`${option.id}\` — ${option.name} · provider \`${option.provider_id}\`` +
        ` · price_type ${option.price_type}`
    )
  }
  out()

  const codOptions = shippingOptions.filter(
    (option) =>
      looksLikeCod(option.name) || looksLikeCod(JSON.stringify(option.data || {}))
  )
  out(
    `**Cash-on-delivery options:** ${codOptions.length}` +
      (codOptions.length === 0
        ? " → D1 (no COD) holds."
        : " → ⚠ D1 says COD must not exist. Report to Matěj: " +
          codOptions.map((option) => `\`${option.id}\` ${option.name}`).join(", "))
  )
  out()

  out(`**Made-to-order products with a production profile:** ${mtoProfiles.length}`)
  const managedMtoVariants = []
  for (const profile of mtoProfiles) {
    const variants = profile.product?.variants || []
    const managed = variants.filter((variant) => variant.manage_inventory)
    if (managed.length) {
      managedMtoVariants.push({ profile, managed })
    }
    out(
      `- ${profile.product?.title || profile.product_id} — ${variants.length} variant(s), ` +
        `${managed.length} with manage_inventory = true`
    )
  }
  out(
    managedMtoVariants.length === 0
      ? "→ MTO variants already excluded from stock tracking; P6-6 is a no-op."
      : `→ P6-6 must clear manage_inventory on ${managedMtoVariants.length} product(s).`
  )
  out()

  out(`**Orders scanned:** ${orders.length}`)
  out(`**Unshipped, non-cancelled orders on a Packeta method:** ${openPacketaOrders.length}`)
  for (const order of openPacketaOrders) {
    out(
      `- #${order.display_id} · ${order.created_at?.slice(0, 10)} · ` +
        `platba ${order.payment_status} · expedice ${order.fulfillment_status}`
    )
  }
  out(
    openPacketaOrders.length === 0
      ? "→ P4-5: Packeta provider can be left dormant; its planned fixes stay out of scope."
      : "→ P4-5: these must be shipped manually via the native order page before Matěj removes the Packeta shipping options."
  )

  console.log(lines.join("\n"))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
