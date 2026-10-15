// Prostředí pro procesy sandboxu.
//
// Zásada: do potomka se NIKDY nedostane hodnota z `backend/.env` ani
// `storefront/.env.local`. Odsud se z nich čtou jen JMÉNA proměnných — každé
// takové jméno se v potomkovi nastaví explicitně (na bezpečnou hodnotu nebo na
// prázdný řetězec), takže dotenv / @next/env ho nepřepíše, ani kdyby se
// k souboru dostaly. Že se k němu nedostanou, hlídá ještě `env-guard.cjs`.
import fs from "node:fs"
import path from "node:path"

import {
  BACKEND_DIR,
  BACKEND_URL,
  DATABASE_URL,
  DEV_EMAIL,
  GUARD_PATH,
  MAIL_URL,
  OWNER_EMAIL,
  PORTS,
  REPO_DIR,
  SEED_STATE_FILE,
  STOREFRONT_DIR,
  STOREFRONT_URL,
} from "./config.mjs"
import { SANDBOX_MANIFEST } from "./legal-manifest.mjs"

/** Jen jména klíčů z env souboru — hodnoty se zahazují hned při čtení. */
export function envFileKeys(file) {
  try {
    const text = fs.readFileSync(file, "utf8")
    const keys = []
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
      if (m) keys.push(m[1])
    }
    return keys
  } catch {
    return []
  }
}

function productionEnvKeys() {
  const files = [
    path.join(BACKEND_DIR, ".env"),
    path.join(STOREFRONT_DIR, ".env.local"),
    path.join(STOREFRONT_DIR, ".env"),
    path.join(REPO_DIR, ".env"),
  ]
  // Všechny další `.env.*` v těch adresářích (kromě šablon).
  for (const dir of [BACKEND_DIR, STOREFRONT_DIR, REPO_DIR]) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (/^\.env\./i.test(f) && !/\.(template|example)$/i.test(f)) files.push(path.join(dir, f))
      }
    } catch {}
  }
  return [...new Set(files.flatMap(envFileKeys))]
}

/** Prefixy proměnných, které v sandboxu nesmí zdědit nic z rodičovského shellu. */
const SENSITIVE_PREFIXES = [
  "R2_", "MINIO_", "IDOKLAD_", "COMGATE_", "SEGMENT_", "ALGOLIA_", "MEILISEARCH_",
  "SANITY_", "IMPORT_ADMIN_", "GOOGLE_", "CP_", "BALIKOVNA_", "PACKETA_", "STRIPE_",
  "SENDGRID_", "RESEND_", "SUPABASE_", "NEXT_PUBLIC_SUPABASE_", "CMS_", "RAILWAY_",
  "POSTHOG_", "CLARITY_", "NEXT_PUBLIC_CLARITY_", "PAGESPEED_", "DATABASE_", "REDIS_",
  "MEDUSA_", "NEXT_PUBLIC_MEDUSA_", "REVALIDATE_", "ADMIN_BRIDGE_", "SELLER_",
  "NEXT_PUBLIC_SANITY_", "NEXT_PUBLIC_PACKETA_", "NEXT_PUBLIC_STRIPE_", "NEXT_PUBLIC_GA_",
  "VITE_", "JWT_", "COOKIE_", "PG", "SHIPPING_PROFILE_", "REPAIR_",
]

function baseEnv() {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    if (SENSITIVE_PREFIXES.some((p) => k.toUpperCase().startsWith(p))) delete env[k]
  }
  // Vše, co je v ostrých env souborech, explicitně prázdné (přebije se níž).
  for (const k of productionEnvKeys()) env[k] = ""
  delete env.NODE_OPTIONS
  return env
}

function guardOptions(extra = "") {
  return `--require ${GUARD_PATH}${extra ? " " + extra : ""}`
}

/**
 * Prostředí backendu (medusa start / exec / db:migrate).
 * @param {{ admin?: boolean }} opts
 */
export function backendEnv(opts = {}) {
  const env = baseEnv()
  Object.assign(env, {
    SANDBOX_GUARD: "1",
    SANDBOX_ROLE: "backend",
    NODE_OPTIONS: guardOptions(),
    NODE_ENV: "development",

    DATABASE_URL,
    REDIS_URL: "",
    MEDUSA_WORKER_MODE: "shared",
    MEDUSA_DISABLE_ADMIN: opts.admin ? "false" : "true",
    MEDUSA_DISABLE_TELEMETRY: "true",
    MEDUSA_ADMIN_ONBOARDING_TYPE: "",
    USE_CONSTANTS_ENV: "",

    JWT_SECRET: "sandbox-jwt-secret-not-for-production",
    COOKIE_SECRET: "sandbox-cookie-secret-not-for-production",
    JWT_EXPIRES_IN: "",

    STORE_CORS: `${STOREFRONT_URL},http://127.0.0.1:${PORTS.storefront}`,
    ADMIN_CORS: `${BACKEND_URL},http://127.0.0.1:${PORTS.backend},http://localhost:7001`,
    AUTH_CORS: `${STOREFRONT_URL},${BACKEND_URL},http://127.0.0.1:${PORTS.storefront},http://localhost:7001`,

    BACKEND_PUBLIC_URL: BACKEND_URL,
    BACKEND_URL: BACKEND_URL,
    MEDUSA_BACKEND_URL: BACKEND_URL,
    VITE_BACKEND_URL: BACKEND_URL,
    STOREFRONT_PUBLIC_URL: STOREFRONT_URL,
    MEDUSA_STOREFRONT_URL: STOREFRONT_URL,
    STOREFRONT_COUNTRY: "cz",
    RAILWAY_PUBLIC_DOMAIN_VALUE: "",

    // E-maily: Resend SDK čte RESEND_BASE_URL při načtení modulu → zachytávač.
    RESEND_API_KEY: "re_sandbox",
    RESEND_FROM_EMAIL: "sandbox@example.test",
    RESEND_FROM: "",
    RESEND_BASE_URL: MAIL_URL,
    RESEND_DAILY_QUOTA: "0",
    RESEND_WEBHOOK_SECRET: "",
    SENDGRID_API_KEY: "",
    SENDGRID_FROM: "",
    SENDGRID_FROM_EMAIL: "",
    OWNER_NOTIFICATION_EMAIL: OWNER_EMAIL,
    DEV_NOTIFICATION_EMAIL: DEV_EMAIL,

    // Soubory: bez R2/MinIO → lokální disk (backend/static, gitignored).
    R2_ENDPOINT: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    R2_BUCKET: "",
    R2_PUBLIC_URL: "",
    MINIO_ENDPOINT: "",
    MINIO_ACCESS_KEY: "",
    MINIO_SECRET_KEY: "",
    MINIO_BUCKET: "",
    MINIO_PORT: "",

    // Fakturace, platby, dopravci, analytika — vše vypnuté.
    IDOKLAD_CLIENT_ID: "",
    IDOKLAD_CLIENT_SECRET: "",
    IDOKLAD_APPLICATION_ID: "",
    IDOKLAD_VAT_PAYER: "",
    IDOKLAD_NUMERIC_SEQUENCE_ID: "",
    IDOKLAD_TEST_MODE: "",
    IDOKLAD_WEBHOOK_SECRET: "",
    IDOKLAD_WEBHOOK_PUBLIC_ID: "",
    // ComGate: provider bez merchant/secret odmítne naběhnout (validateOptions),
    // proto sandboxové hodnoty. Adresa ComGate je v kódu natvrdo — env-guard ji
    // přesměruje na lokální maketu (lib/comgate-mock.mjs). Ven nejde nic.
    COMGATE_MERCHANT: "sandbox-merchant",
    COMGATE_SECRET: "sandbox-secret",
    COMGATE_TEST: "true",
    COMGATE_COUNTRY: "",
    COMGATE_CURRENCY: "",
    COMGATE_METHOD: "",
    SANDBOX_SERVICES_URL: MAIL_URL,
    SANDBOX_EGRESS_ALLOW: "",
    // Manifest PDF s https adresou v sandboxu (vyrábí lib/legal-manifest.mjs).
    SANDBOX_LEGAL_MANIFEST: SANDBOX_MANIFEST,
    STRIPE_API_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    SEGMENT_WRITE_KEY: "",
    BALIKOVNA_API_URL: "",
    BALIKOVNA_API_TOKEN: "",
    BALIKOVNA_API_SECRET: "",
    BALIKOVNA_API_CUSTOMER_ID: "",
    BALIKOVNA_API_POST_CODE: "",
    BALIKOVNA_API_CONTRACT_NUMBER: "",
    BALIKOVNA_API_LOCATION_NUMBER: "",
    PACKETA_API_KEY: "",
    ALGOLIA_API_KEY: "",
    ALGOLIA_APP_ID: "",
    ALGOLIA_PRODUCT_INDEX_NAME: "",
    MEILISEARCH_HOST: "",
    MEILISEARCH_API_KEY: "",
    MEILISEARCH_MASTER_KEY: "",
    MEILISEARCH_ADMIN_KEY: "",
    SANITY_API_TOKEN: "",
    SANITY_PROJECT_ID: "",
    SANITY_STUDIO_URL: "",
    IMPORT_ADMIN_EMAIL: "",
    IMPORT_ADMIN_PASSWORD: "",
    GOOGLE_PLACE_ID: "",
    GOOGLE_API_KEY: "",
    GOOGLE_MAPS_API_KEY: "",
    CMS_STUDIO_URL: "",
    CMS_CRON_SECRET: "",
    REVALIDATE_SECRET: "",
    ADMIN_BRIDGE_SECRET: "",
    MEDUSA_PUBLISHABLE_KEY: "",
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "",
  })
  return env
}

export function readSeedState() {
  try {
    return JSON.parse(fs.readFileSync(SEED_STATE_FILE, "utf8"))
  } catch {
    return null
  }
}

/**
 * Jen tyto hodnoty ze `storefront/.env.local` smí do sandbox storefrontu:
 * veřejné údaje o prodávající (IČO, sídlo, účet — tisknou se na webu i v OP),
 * žádné přístupy.
 */
const STOREFRONT_PUBLIC_FACTS = [
  "IDENTIFIKACNI_CISLO",
  "SIDLO_ADRESA",
  "CISLO_UCTU",
  "IBAN",
  "SWIFT_KOD",
  "INTERNETOVA_ADRESA",
  "NEXT_PUBLIC_DEFAULT_REGION",
]

function readWhitelisted(file, names) {
  const out = {}
  try {
    const text = fs.readFileSync(file, "utf8")
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && names.includes(m[1])) out[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}
  return out
}

/**
 * Prostředí storefrontu (next dev na 8100).
 * @param {{ publishableKey: string, distDir?: string }} opts
 */
export function storefrontEnv(opts) {
  const env = baseEnv()
  const facts = readWhitelisted(path.join(STOREFRONT_DIR, ".env.local"), STOREFRONT_PUBLIC_FACTS)
  Object.assign(env, facts, {
    SANDBOX_GUARD: "1",
    SANDBOX_ROLE: "storefront",
    NODE_OPTIONS: guardOptions(),
    NODE_ENV: "development",
    PORT: String(PORTS.storefront),
    NEXT_DIST_DIR: opts.distDir || ".next",
    NEXT_TELEMETRY_DISABLED: "1",
    SANDBOX_SERVICES_URL: MAIL_URL,
    // Jen čtení: Google Fonts pro next/font. Vše ostatní (CMS, analytika …) blokováno.
    SANDBOX_EGRESS_ALLOW: "fonts.googleapis.com,fonts.gstatic.com",
    ...(opts.protectedDir ? { SANDBOX_EXTRA_PROTECTED_DIR: opts.protectedDir } : {}),

    NEXT_PUBLIC_MEDUSA_BACKEND_URL: BACKEND_URL,
    MEDUSA_BACKEND_URL: BACKEND_URL,
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: opts.publishableKey,
    NEXT_PUBLIC_BASE_URL: STOREFRONT_URL,
    NEXT_PUBLIC_SITE_URL: STOREFRONT_URL,
    NEXT_PUBLIC_DEFAULT_REGION: facts.NEXT_PUBLIC_DEFAULT_REGION || "cz",

    // CMS (ValeCMS/Supabase) vypnuté: web padá zpět na texty z kódu.
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    CMS_ADMIN_EMAIL: "",
    CMS_ADMIN_PASSWORD: "",
    CMS_SESSION_SECRET: "",
    CMS_IP_HASH_SALT: "",
    CMS_MAIL_FROM: "",
    CMS_MEDIA_BUCKET: "",
    CMS_MEDIA_HOST: "",
    CMS_STORAGE_DRIVER: "",
    CMS_CRON_SECRET: "",
    NEXT_PUBLIC_CMS_BRAND: "",
    ...(opts.cmsStoreDir ? { CMS_FILE_STORE_DIR: opts.cmsStoreDir } : {}),

    // Nic, co odesílá nebo zapisuje.
    RESEND_API_KEY: "",
    REVALIDATE_SECRET: "sandbox-revalidate",
    ADMIN_BRIDGE_SECRET: "",
    IDOKLAD_CLIENT_ID: "",
    IDOKLAD_CLIENT_SECRET: "",
    BALIKOVNA_API_TOKEN: "",
    BALIKOVNA_API_SECRET: "",
    BALIKOVNA_API_URL: "",
    CLARITY_API_TOKEN: "",
    NEXT_PUBLIC_CLARITY_PROJECT_ID: "",
    PAGESPEED_API_KEY: "",
    NEXT_PUBLIC_STRIPE_KEY: "",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "",
    NEXT_PUBLIC_SANITY_DATASET: "",
    DATABASE_URL: "",
  })
  return env
}

/** Pro report: jména proměnných, které potomek dostane neprázdné. */
export function describeEnv(env) {
  return Object.keys(env)
    .filter((k) => env[k] !== "" && SENSITIVE_PREFIXES.some((p) => k.toUpperCase().startsWith(p)))
    .sort()
}

export { SEED_STATE_FILE }
