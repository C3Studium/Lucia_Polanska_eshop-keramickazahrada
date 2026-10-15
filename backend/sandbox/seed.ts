/**
 * Seed sandboxu — spouští se přes `node sandbox/backend.mjs seed`
 * (= `medusa exec ./sandbox/seed.ts` se sandboxovým prostředím).
 *
 * Idempotentní: všechno se hledá podle názvu / handle a zakládá jen, když
 * chybí. Druhý běh nic nezdvojí, jen doplní, co chybí, a přepíše seed-state.
 *
 * Co vznikne:
 * - obchod (CZK výchozí + EUR), prodejní kanál, publishable key „Webshop“
 * - regiony Česká republika (CZK, cz) a Slovensko (EUR, sk) s poskytovateli
 *   plateb pp_system_default, pp_comgate_comgate (→ lokální maketa),
 *   pp_osobni-odber_pickup, pp_dobirka_ceska-posta (jen CZ)
 * - daňové regiony cz/sk (tp_system, bez sazby — neplátce DPH)
 * - sklad „Ateliér Putim“ + výchozí profil dopravy
 * - doprava: osobní odběr (pickup, CZ+SK, 0), Česká pošta na adresu,
 *   Balíkovna, Česká pošta — křehké (CZ, CZK), na adresu + křehké (SK, EUR)
 * - kategorie keramika / zakazkova-vyroba / darkove-poukazy + kolekce
 * - produkty: (a) běžný výrobek skladem, (b) výrobek na zakázku s profilem
 *   výroby, (c) poukaz s vlastní částkou, (c2) poukaz s pevnou cenou
 * - (d) vypsaný termín kurzu za 3 týdny
 * - nastavení obchodu: e-maily majitelky/vývojáře do sandboxu, zkušební režim
 *
 * Výsledek (id, publishable key) jde do sandbox/.run/seed-state.json.
 */
import fs from "node:fs"
import path from "node:path"

import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateInventoryLevelsWorkflow,
  updateRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

import { setMerchantSettings } from "../src/lib/merchant-settings"
import { MADE_TO_ORDER_MODULE } from "../src/modules/made-to-order"
import { COURSE_MODULE } from "../src/modules/course"
import { createMerchantCollectionWorkflow } from "../src/workflows/manage-merchant-collection"

const STATE_FILE = path.resolve(process.cwd(), "sandbox", ".run", "seed-state.json")

const OWNER_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL || "owner@sandbox.test"
const DEV_EMAIL = process.env.DEV_NOTIFICATION_EMAIL || "dev@sandbox.test"
/** `SANDBOX_SYSTEM_PAYMENT=0` → bez „Testovací platby“ (věrnější produkčnímu UI). */
const WITH_SYSTEM_PAYMENT = process.env.SANDBOX_SYSTEM_PAYMENT !== "0"

const PICKUP_FULFILLMENT = "pickup_osobni-odber"
const CP_FULFILLMENT = "ceska-posta-fulfillment_balikovna"

type Any = any

export default async function seedSandbox({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK) as Any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Any
  const storeModule = container.resolve(Modules.STORE) as Any
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as Any
  const apiKeyModule = container.resolve(Modules.API_KEY) as Any
  const regionModule = container.resolve(Modules.REGION) as Any
  const taxModule = container.resolve(Modules.TAX) as Any
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION) as Any
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as Any
  const productModule = container.resolve(Modules.PRODUCT) as Any
  const inventoryModule = container.resolve(Modules.INVENTORY) as Any
  const madeToOrder = container.resolve(MADE_TO_ORDER_MODULE) as Any
  const course = container.resolve(COURSE_MODULE) as Any

  const say = (m: string) => logger.info(`[sandbox-seed] ${m}`)

  // Pojistka: seed se nesmí nikdy pustit proti jiné databázi než sandboxové.
  const dbUrl = process.env.DATABASE_URL || ""
  if (!/@(127\.0\.0\.1|localhost):54329\//.test(dbUrl)) {
    throw new Error("sandbox seed: DATABASE_URL není sandboxová databáze — končím.")
  }

  /* ---------------- Prodejní kanál ---------------- */
  let [salesChannel] = await salesChannelModule.listSalesChannels({ name: "Default Sales Channel" })
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    })
    salesChannel = result[0]
  }
  say(`prodejní kanál ${salesChannel.id}`)

  /* ---------------- Obchod ---------------- */
  const [store] = await storeModule.listStores()
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Keramická zahrada (SANDBOX)",
        supported_currencies: [
          { currency_code: "czk", is_default: true },
          { currency_code: "eur" },
        ],
        default_sales_channel_id: salesChannel.id,
      },
    },
  })
  say(`obchod ${store.id}: CZK (výchozí) + EUR`)

  /* ---------------- Publishable key „Webshop“ ---------------- */
  let [apiKey] = await apiKeyModule.listApiKeys({ title: "Webshop", type: "publishable" })
  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Webshop", type: "publishable", created_by: "sandbox-seed" }] },
    })
    apiKey = result[0]
  }
  try {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: [salesChannel.id] },
    })
  } catch (e: Any) {
    if (!String(e?.message).match(/already|exist/i)) throw e
  }
  say(`publishable key Webshop ${apiKey.id}`)

  /* ---------------- Regiony ---------------- */
  const czProviders = [
    ...(WITH_SYSTEM_PAYMENT ? ["pp_system_default"] : []),
    "pp_comgate_comgate",
    "pp_osobni-odber_pickup",
    "pp_dobirka_ceska-posta",
  ]
  const skProviders = [
    ...(WITH_SYSTEM_PAYMENT ? ["pp_system_default"] : []),
    "pp_comgate_comgate",
    "pp_osobni-odber_pickup",
  ]
  const regionSpecs = [
    { name: "Česká republika", currency_code: "czk", countries: ["cz"], payment_providers: czProviders },
    { name: "Slovensko", currency_code: "eur", countries: ["sk"], payment_providers: skProviders },
  ]
  const regions: Record<string, Any> = {}
  for (const spec of regionSpecs) {
    let [region] = await regionModule.listRegions({ name: spec.name })
    if (!region) {
      const { result } = await createRegionsWorkflow(container).run({
        input: { regions: [{ ...spec, automatic_taxes: true }] },
      })
      region = result[0]
      say(`region ${spec.name} založen (${region.id})`)
    } else {
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: region.id }, update: { payment_providers: spec.payment_providers } },
      })
      say(`region ${spec.name} existuje (${region.id}) — poskytovatelé plateb srovnáni`)
    }
    regions[spec.countries[0]] = region
  }

  /* ---------------- Daňové regiony (neplátce DPH → bez sazby) ---------------- */
  for (const country_code of ["cz", "sk"]) {
    const existing = await taxModule.listTaxRegions({ country_code })
    if (!existing.length) {
      await createTaxRegionsWorkflow(container).run({
        input: [{ country_code, provider_id: "tp_system" }],
      })
      say(`daňový region ${country_code}`)
    }
  }

  /* ---------------- Sklad ---------------- */
  let [location] = await stockLocationModule.listStockLocations({ name: "Ateliér Putim" })
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Ateliér Putim",
            address: {
              address_1: "Putim 229",
              city: "Písek",
              postal_code: "397 01",
              country_code: "CZ",
            },
          },
        ],
      },
    })
    location = result[0]
  }
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: [salesChannel.id] },
    })
  } catch (e: Any) {
    if (!String(e?.message).match(/already|exist/i)) throw e
  }
  for (const providerId of [CP_FULFILLMENT, PICKUP_FULFILLMENT]) {
    await safeLink(link, {
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
    })
  }
  say(`sklad ${location.id}`)

  /* ---------------- Profil dopravy ---------------- */
  let [shippingProfile] = await fulfillmentModule.listShippingProfiles({ type: "default" })
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    shippingProfile = result[0]
  }
  say(`profil dopravy ${shippingProfile.id}`)

  /* ---------------- Fulfillment sety a zóny ---------------- */
  const pickupSet = await ensureFulfillmentSet(fulfillmentModule, link, location.id, {
    name: "Ateliér Putim — osobní odběr",
    type: "pickup",
    service_zones: [{ name: "Osobní odběr (CZ + SK)", geo_zones: [{ type: "country", country_code: "cz" }, { type: "country", country_code: "sk" }] }],
  })
  const shippingSet = await ensureFulfillmentSet(fulfillmentModule, link, location.id, {
    name: "Ateliér Putim — doprava",
    type: "shipping",
    service_zones: [
      { name: "Česko", geo_zones: [{ type: "country", country_code: "cz" }] },
      { name: "Slovensko", geo_zones: [{ type: "country", country_code: "sk" }] },
    ],
  })
  const zone = (set: Any, name: string) => set.service_zones.find((z: Any) => z.name === name)

  /* ---------------- Možnosti dopravy ---------------- */
  const storeRules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" },
    { attribute: "is_return", value: "false", operator: "eq" },
  ]
  const optionSpecs = [
    {
      key: "pickup",
      name: "Osobní odběr v ateliéru",
      provider_id: PICKUP_FULFILLMENT,
      service_zone_id: pickupSet.service_zones[0].id,
      data: { id: "personal-pickup", service_code: "PICKUP", personal_pickup: true },
      prices: [{ currency_code: "czk", amount: 0 }, { currency_code: "eur", amount: 0 }],
      type: { label: "Osobní odběr", description: "Vyzvednutí v ateliéru", code: "personal-pickup" },
    },
    {
      key: "cz_address",
      name: "Česká pošta — na adresu",
      provider_id: CP_FULFILLMENT,
      service_zone_id: zone(shippingSet, "Česko").id,
      data: { id: "cp-address", service_code: "DR" },
      prices: [{ currency_code: "czk", amount: 150 }],
      type: { label: "Česká pošta", description: "Doručení na adresu", code: "cp-address" },
    },
    {
      key: "cz_balikovna",
      name: "Balíkovna",
      provider_id: CP_FULFILLMENT,
      service_zone_id: zone(shippingSet, "Česko").id,
      data: { id: "balikovna", service_code: "NB" },
      prices: [{ currency_code: "czk", amount: 90 }],
      type: { label: "Balíkovna", description: "Výdejní místo Balíkovna", code: "balikovna" },
    },
    {
      key: "cz_fragile",
      name: "Česká pošta — křehké zboží na adresu",
      provider_id: CP_FULFILLMENT,
      service_zone_id: zone(shippingSet, "Česko").id,
      data: { id: "cp-fragile", service_code: "DR", fragile: true },
      prices: [{ currency_code: "czk", amount: 250 }],
      type: { label: "Česká pošta — křehké", description: "Křehké zboží na adresu", code: "cp-fragile" },
    },
    {
      key: "sk_address",
      name: "Česká pošta — na adresu (Slovensko)",
      provider_id: CP_FULFILLMENT,
      service_zone_id: zone(shippingSet, "Slovensko").id,
      data: { id: "cp-address", service_code: "DR" },
      prices: [{ currency_code: "eur", amount: 12 }],
      type: { label: "Česká pošta", description: "Doručení na adresu (SK)", code: "cp-address-sk" },
    },
    {
      key: "sk_fragile",
      name: "Česká pošta — křehké zboží (Slovensko)",
      provider_id: CP_FULFILLMENT,
      service_zone_id: zone(shippingSet, "Slovensko").id,
      data: { id: "cp-fragile", service_code: "DR", fragile: true },
      prices: [{ currency_code: "eur", amount: 18 }],
      type: { label: "Česká pošta — křehké", description: "Křehké zboží (SK)", code: "cp-fragile-sk" },
    },
  ]
  const shippingOptions: Record<string, string> = {}
  for (const spec of optionSpecs) {
    const { key, ...input } = spec
    const [existing] = await fulfillmentModule.listShippingOptions({ name: spec.name })
    if (existing) {
      shippingOptions[key] = existing.id
      continue
    }
    const { result } = await createShippingOptionsWorkflow(container).run({
      input: [
        {
          ...input,
          price_type: "flat",
          shipping_profile_id: shippingProfile.id,
          rules: storeRules,
        } as Any,
      ],
    })
    shippingOptions[key] = result[0].id
    say(`doprava „${spec.name}“ ${result[0].id}`)
  }

  /* ---------------- Kategorie ---------------- */
  const categorySpecs = [
    { name: "Keramika", handle: "keramika" },
    { name: "Zakázková výroba", handle: "zakazkova-vyroba" },
    { name: "Dárkové poukazy", handle: "darkove-poukazy" },
  ]
  const categories: Record<string, Any> = {}
  for (const spec of categorySpecs) {
    let [cat] = await productModule.listProductCategories({ handle: spec.handle })
    if (!cat) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: [{ ...spec, is_active: true, is_internal: false }] },
      })
      cat = result[0]
    }
    categories[spec.handle] = cat
  }
  say(`kategorie: ${Object.keys(categories).join(", ")}`)

  /* ---------------- Produkty ---------------- */
  const productSpecs = [
    {
      key: "regular",
      title: "Sandbox — Miska Zahrada",
      handle: "sandbox-miska-zahrada",
      description: "Běžný keramický výrobek skladem (sandbox).",
      category: "keramika",
      metadata: { packaging_price: 49 },
      variant: {
        title: "Standard",
        sku: "SBX-MISKA",
        manage_inventory: true,
        prices: [{ currency_code: "czk", amount: 890 }, { currency_code: "eur", amount: 36 }],
      },
      stock: 10,
    },
    {
      key: "made_to_order",
      title: "Sandbox — Květináč na zakázku",
      handle: "sandbox-kvetinac-na-zakazku",
      description: "Výrobek na zakázku — vyrábí se podle zadání zákazníka (sandbox).",
      category: "zakazkova-vyroba",
      metadata: {
        made_to_order: true,
        made_to_order_prompt: "Napište rozměry, barvu glazury a pošlete fotku místa, kam květináč patří.",
        packaging_price: 79,
      },
      variant: {
        title: "Na zakázku",
        sku: "SBX-ZAKAZKA",
        manage_inventory: false,
        prices: [{ currency_code: "czk", amount: 2400 }, { currency_code: "eur", amount: 96 }],
      },
      productionProfile: true,
    },
    {
      key: "voucher_custom",
      title: "Sandbox — Dárkový poukaz (vlastní částka)",
      handle: "sandbox-darkovy-poukaz",
      description: "Dárkový poukaz na nákup keramiky s částkou dle volby (sandbox).",
      category: "darkove-poukazy",
      metadata: {
        voucher_custom_amount: true,
        voucher_min: 500,
        voucher_max: 10000,
        voucher_step: 100,
        voucher_currency: "czk",
        cod_allowed: false,
      },
      // Katalogová cena 1 Kč jako produkční poukaz „1 Kč" — cenu řádku musí
      // nastavit zvolená částka (metadata.voucher_amount), ne katalog.
      variant: {
        title: "Vlastní částka",
        sku: "SBX-POUKAZ",
        manage_inventory: false,
        prices: [{ currency_code: "czk", amount: 1 }],
      },
    },
    {
      key: "voucher_fixed",
      title: "Sandbox — Dárkový poukaz 1 000 Kč",
      handle: "sandbox-darkovy-poukaz-1000",
      description: "Dárkový poukaz s pevnou hodnotou 1 000 Kč (sandbox).",
      category: "darkove-poukazy",
      metadata: { cod_allowed: false },
      variant: {
        title: "1 000 Kč",
        sku: "SBX-POUKAZ-1000",
        manage_inventory: false,
        prices: [{ currency_code: "czk", amount: 1000 }, { currency_code: "eur", amount: 40 }],
      },
    },
  ]

  const products: Record<string, { id: string; handle: string; variant_id: string }> = {}
  for (const spec of productSpecs) {
    let [product] = await productModule.listProducts({ handle: spec.handle }, { relations: ["variants"] })
    if (!product) {
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: spec.title,
              handle: spec.handle,
              description: spec.description,
              status: ProductStatus.PUBLISHED,
              discountable: true,
              shipping_profile_id: shippingProfile.id,
              category_ids: [categories[spec.category].id],
              sales_channels: [{ id: salesChannel.id }],
              metadata: spec.metadata,
              options: [{ title: "Varianta", values: [spec.variant.title] }],
              variants: [
                {
                  title: spec.variant.title,
                  sku: spec.variant.sku,
                  manage_inventory: spec.variant.manage_inventory,
                  allow_backorder: false,
                  options: { Varianta: spec.variant.title },
                  prices: spec.variant.prices,
                },
              ],
            } as Any,
          ],
        },
      })
      product = result[0]
      say(`produkt „${spec.title}“ ${product.id}`)
    } else {
      await productModule.updateProducts(product.id, { metadata: spec.metadata })
    }
    const variant = (product.variants ?? [])[0] ??
      (await productModule.listProductVariants({ product_id: product.id }))[0]
    products[spec.key] = { id: product.id, handle: spec.handle, variant_id: variant.id }

    // Sklad — úroveň zásoby na jediném skladu.
    if (spec.variant.manage_inventory) {
      const { data: links } = await query.graph({
        entity: "product_variant",
        fields: ["id", "inventory_items.inventory_item_id"],
        filters: { id: variant.id },
      })
      const inventoryItemId = links?.[0]?.inventory_items?.[0]?.inventory_item_id
      if (inventoryItemId) {
        // Subscriber `default-inventory-level` běží i v `medusa exec` a zakládá
        // úroveň 0 souběžně — proto „založ, a když už je, uprav".
        const level = { inventory_item_id: inventoryItemId, location_id: location.id, stocked_quantity: spec.stock ?? 0 }
        const levels = await inventoryModule.listInventoryLevels({
          inventory_item_id: inventoryItemId,
          location_id: location.id,
        })
        let created = false
        if (!levels.length) {
          try {
            await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: [level] } })
            created = true
          } catch (e: Any) {
            if (!String(e?.message).match(/already exists/i)) throw e
          }
        }
        if (!created) {
          await updateInventoryLevelsWorkflow(container).run({ input: { updates: [level] } })
        }
        say(`zásoba ${spec.variant.sku}: ${level.stocked_quantity} ks`)
      }
    }

    // Profil výroby — stejně jako PATCH /admin/made-to-order/products/:id.
    if (spec.productionProfile) {
      const profilePayload = {
        enabled: true,
        specification_required: true,
        specification_prompt: null,
        production_time_min_days: 14,
        production_time_max_days: 42,
        default_deposit_percentage: 25,
        contact_customer_after_order: true,
        allow_final_price_adjustment: true,
        allow_full_prepayment: true,
      }
      const existing = await madeToOrder.listProductProductionProfiles({ product_id: product.id })
      if (existing[0]) {
        await madeToOrder.updateProductProductionProfiles({ id: existing[0].id, ...profilePayload })
      } else {
        await madeToOrder.createProductProductionProfiles({ product_id: product.id, ...profilePayload })
      }
      // Zrcadlení příznaku do metadat (mirrorMadeToOrderFlag v admin routě).
      await productModule.updateProducts(product.id, { metadata: { made_to_order: true } })
      say(`profil výroby zapnut pro ${product.id}`)
    }
  }

  /* ---------------- Kolekce (navigace storefrontu) ---------------- */
  const collectionSpecs = [
    { title: "Objekty", handle: "objekty", products: ["regular"], category: "keramika", order: 1 },
    { title: "Zakázky", handle: "zakazky", products: ["made_to_order"], category: "zakazkova-vyroba", order: 2 },
    { title: "Poukazy", handle: "poukazy", products: ["voucher_custom", "voucher_fixed"], category: "darkove-poukazy", order: 3 },
  ]
  for (const spec of collectionSpecs) {
    const [existing] = await productModule.listProductCollections({ handle: spec.handle })
    if (existing) continue
    try {
      await createMerchantCollectionWorkflow(container).run({
        input: {
          title: spec.title,
          handle: spec.handle,
          product_ids: spec.products.map((k) => products[k].id),
          profile: { storefront_visible: true, display_order: spec.order } as Any,
          categories: [{ category_id: categories[spec.category].id, display_order: 1 } as Any],
        },
      })
      say(`kolekce ${spec.title}`)
    } catch (e: Any) {
      logger.warn(`[sandbox-seed] kolekce ${spec.title} se nepovedla: ${e?.message}`)
    }
  }

  /* ---------------- Kurz ---------------- */
  const courseTitle = "Sandbox — Večerní kurz točení na kruhu"
  const startsAt = new Date()
  startsAt.setDate(startsAt.getDate() + 21)
  startsAt.setHours(17, 0, 0, 0)
  let [term] = await course.listCourseTerms({ title: courseTitle })
  if (!term) {
    term = await course.createCourseTerms({
      title: courseTitle,
      location: "Ateliér Putim",
      starts_at: startsAt,
      duration_minutes: 180,
      capacity: 8,
      price_single: 1200,
      price_two: 1100,
      status: "published",
      note: "Sandbox — testovací termín.",
    })
    say(`termín kurzu ${term.id} (${startsAt.toISOString()})`)
  } else if (new Date(term.starts_at) < new Date(Date.now() + 3 * 864e5)) {
    // Termín by brzy „prošel" — posunout ho zase do budoucna.
    await course.updateCourseTerms({ id: term.id, starts_at: startsAt, status: "published" })
    say(`termín kurzu ${term.id} posunut na ${startsAt.toISOString()}`)
  }

  /* ---------------- Nastavení obchodu ---------------- */
  await setMerchantSettings(container as Any, {
    owner_notification_email: OWNER_EMAIL,
    dev_notification_email: DEV_EMAIL,
    test_mode_enabled: true,
  } as Any)
  say(`nastavení obchodu: e-maily ${OWNER_EMAIL} / ${DEV_EMAIL}, zkušební režim zapnut`)

  /* ---------------- Stav pro skripty ---------------- */
  const state = {
    seeded_at: new Date().toISOString(),
    publishable_key: apiKey.token,
    sales_channel_id: salesChannel.id,
    store_id: store.id,
    regions: { cz: regions.cz.id, sk: regions.sk.id },
    stock_location_id: location.id,
    shipping_profile_id: shippingProfile.id,
    shipping_options: shippingOptions,
    products,
    course_term_id: term.id,
    payment_providers: { cz: czProviders, sk: skProviders },
  }
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  say(`hotovo → ${STATE_FILE}`)
}

async function safeLink(link: Any, def: Any) {
  try {
    await link.create(def)
  } catch (e: Any) {
    if (!String(e?.message).match(/already|exist|duplicate|unique/i)) throw e
  }
}

async function ensureFulfillmentSet(fulfillmentModule: Any, link: Any, locationId: string, spec: Any) {
  let [set] = await fulfillmentModule.listFulfillmentSets({ name: spec.name }, { relations: ["service_zones"] })
  if (!set) {
    set = await fulfillmentModule.createFulfillmentSets(spec)
    set = (await fulfillmentModule.listFulfillmentSets({ id: set.id }, { relations: ["service_zones"] }))[0]
  }
  await safeLink(link, {
    [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
    [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
  })
  return set
}
