console.log('[Constants] Loading constants.ts...')
console.log('[Constants] Current working directory:', process.cwd())
console.log('[Constants] NODE_ENV:', process.env.NODE_ENV)

import { loadEnv } from '@medusajs/framework/utils'

import { assertValue } from '../utils/assert-value'

console.log('[Constants] About to load environment...')
loadEnv(process.env.NODE_ENV || 'development', process.cwd())
console.log('[Constants] Environment loaded')
console.log('[Constants] DATABASE_URL present:', !!process.env.DATABASE_URL)
console.log('[Constants] JWT_SECRET present:', !!process.env.JWT_SECRET)
console.log('[Constants] COOKIE_SECRET present:', !!process.env.COOKIE_SECRET)

/**
 * Is development environment
 */
export const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Public URL for the backend
 */
export const BACKEND_URL = process.env.BACKEND_PUBLIC_URL ?? process.env.RAILWAY_PUBLIC_DOMAIN_VALUE ?? 'http://localhost:9000'
/**
 * Storefront URLs come from `lib/storefront-url.ts`, not from here.
 *
 * There was a `STOREFRONT_URL` const at this spot with nothing using it and
 * two things wrong with it: it fell back to `RAILWAY_PUBLIC_DOMAIN_VALUE`,
 * which is the *backend* domain, and then to `localhost:3000`. Either would
 * have produced a plausible-looking link to the wrong place, in an e-mail,
 * where nobody would notice until a customer did. Removed rather than fixed,
 * so there stays exactly one way to build a customer-facing URL.


/**
 * Database URL for Postgres instance used by the backend
 */
console.log('[Constants] About to assert DATABASE_URL...')
export const DATABASE_URL = (() => {
  try {
    const url = assertValue(
      process.env.DATABASE_URL,
      'Environment variable for DATABASE_URL is not set',
    )
    console.log('[Constants] DATABASE_URL asserted successfully')
    return url
  } catch (error) {
    console.error('[Constants] FAILED to assert DATABASE_URL:', error)
    throw error
  }
})()

/**
 * (optional) Redis URL for Redis instance used by the backend
 */
export const REDIS_URL = process.env.REDIS_URL;

/**
 * Admin CORS origins
 */
export const ADMIN_CORS = process.env.ADMIN_CORS;

/**
 * Auth CORS origins
 */
export const AUTH_CORS = process.env.AUTH_CORS;

/**
 * Store/frontend CORS origins
 */
export const STORE_CORS = process.env.STORE_CORS;

/**
 * JWT Secret used for signing JWT tokens
 */
console.log('[Constants] About to assert JWT_SECRET...')
export const JWT_SECRET = (() => {
  try {
    const secret = assertValue(
      process.env.JWT_SECRET,
      'Environment variable for JWT_SECRET is not set',
    )
    console.log('[Constants] JWT_SECRET asserted successfully')
    return secret
  } catch (error) {
    console.error('[Constants] FAILED to assert JWT_SECRET:', error)
    throw error
  }
})()

/**
 * JWT Expires In
 */
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d'

/**
 * Cookie secret used for signing cookies
 */
console.log('[Constants] About to assert COOKIE_SECRET...')
export const COOKIE_SECRET = (() => {
  try {
    const secret = assertValue(
      process.env.COOKIE_SECRET,
      'Environment variable for COOKIE_SECRET is not set',
    )
    console.log('[Constants] COOKIE_SECRET asserted successfully')
    return secret
  } catch (error) {
    console.error('[Constants] FAILED to assert COOKIE_SECRET:', error)
    throw error
  }
})()

/**
 * (optional) Minio configuration for file storage
 */
export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
export const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
export const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
export const MINIO_BUCKET = process.env.MINIO_BUCKET; // Optional, if not set bucket will be called: medusa-media

/**
 * (optional) Resend API Key and from Email - do not set if using SendGrid
 */
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM;

/**
 * (optionl) SendGrid API Key and from Email - do not set if using Resend
 */
export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
export const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;

/**
 * (optional) Sanity API Key - for CMS tool for the project
 */
export const SANITY_API_TOKEN = process.env.SANITY_API_TOKEN;
export const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID;
export const SANITY_STUDIO_URL = process.env.SANITY_STUDIO_URL;

/**
 * (optional) Segment Writing API Key - For tracking user events and important data for the commerce
 */
export const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY;

/**
 * (optional) Stripe API key and webhook secret
 */
export const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Worker mode
 */
export const WORKER_MODE =
  (process.env.MEDUSA_WORKER_MODE as 'worker' | 'server' | 'shared' | undefined) ?? 'shared'

/**
 * Disable Admin
 */
export const SHOULD_DISABLE_ADMIN = process.env.MEDUSA_DISABLE_ADMIN === 'true'

/**
 * (optional) Comgate payment provider configuration
 */
export const COMGATE_MERCHANT = process.env.COMGATE_MERCHANT
export const COMGATE_SECRET = process.env.COMGATE_SECRET
export const COMGATE_TEST = process.env.COMGATE_TEST
export const COMGATE_COUNTRY = process.env.COMGATE_COUNTRY || 'CZ'
export const COMGATE_CURRENCY = process.env.COMGATE_CURRENCY || 'CZK'
export const COMGATE_METHOD = process.env.COMGATE_METHOD || 'ALL'

/**
 * Legacy — Packeta is being retired (WorkflowPlan.md D8). Kept only so the
 * dormant provider keeps compiling; do not use it in new code.
 */
export const PACKETA_API_KEY = process.env.PACKETA_API_KEY

/**
 * (optional) Merchant notification recipients — WorkflowPlan.md D7.
 *
 * DEV receives technical failures (carrier/API errors, e-mail delivery
 * failures), OWNER receives business events (new paid order, balance received,
 * payment problems, stock digest, reviews). The daily summary goes to both.
 *
 * Both are deliberately optional: an empty value means the notification is
 * skipped with a logged warning, never a crash.
 */
export const DEV_NOTIFICATION_EMAIL = process.env.DEV_NOTIFICATION_EMAIL
export const OWNER_NOTIFICATION_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL

/**
 * (optional) Balíkovna / Česká pošta B2B fulfilment provider — WorkflowPlan.md
 * D8, implemented in P4-1/P4-2.
 *
 * Names confirmed against the nAPI (B2BZasilka) REST interface: an API token
 * (UUID), a base64 secret used to sign each request, and the ID CČK from the
 * contract. All three are generated in Správa B2B profilu.
 *
 * While any of these are absent the provider runs in record-only mode: it
 * records the parcel without calling the carrier, so one-click shipping never
 * blocks on missing configuration — and dispatch then requires her explicit
 * „Zásilku jsem předala dopravci" confirmation (A1).
 *
 * The older POLService API is deliberately not used: it authenticates with
 * PostSignum client certificates, which would mean mounting cert and key files
 * into the container.
 */
export const BALIKOVNA_API_URL = process.env.BALIKOVNA_API_URL
export const BALIKOVNA_API_TOKEN = process.env.BALIKOVNA_API_TOKEN
export const BALIKOVNA_API_SECRET = process.env.BALIKOVNA_API_SECRET
export const BALIKOVNA_API_CUSTOMER_ID = process.env.BALIKOVNA_API_CUSTOMER_ID

/**
 * (optional) iDoklad invoicing — FINISHINGTODOLIST §1.
 *
 * Client id + secret are generated in the iDoklad app itself: Nastavení →
 * Aplikace → záložka API → „Vygenerovat" — and those two are sufficient: the
 * legacy token endpoint accepts them alone (probed 2026-08-14) and the module
 * uses it when no application id is set. The optional application id comes
 * from the iDoklad Developer portal (https://developer.idoklad.cz) and
 * switches token requests to the newer v2 endpoint the current docs describe.
 *
 * While client id/secret are absent the module is not registered and every
 * invoicing entry point is a logged no-op — checkout never depends on it.
 *
 * IDOKLAD_VAT_PAYER stays unset (false): Lucia is not a VAT payer (neplátce
 * DPH), documents go out without VAT. IDOKLAD_NUMERIC_SEQUENCE_ID optionally
 * pins the číselná řada; unset means the agenda default, and the production
 * sequence is chosen only at go-live.
 */
export const IDOKLAD_CLIENT_ID = process.env.IDOKLAD_CLIENT_ID
export const IDOKLAD_CLIENT_SECRET = process.env.IDOKLAD_CLIENT_SECRET
export const IDOKLAD_APPLICATION_ID = process.env.IDOKLAD_APPLICATION_ID
export const IDOKLAD_VAT_PAYER = process.env.IDOKLAD_VAT_PAYER
export const IDOKLAD_NUMERIC_SEQUENCE_ID = process.env.IDOKLAD_NUMERIC_SEQUENCE_ID
/**
 * iDoklad has no sandbox environment: testing means a *separate* trial/free
 * iDoklad account whose own client id/secret go into the vars above. This
 * flag is purely informational — set it while those test credentials are in
 * place so the admin widget labels invoices as going to the test agenda.
 */
export const IDOKLAD_TEST_MODE = process.env.IDOKLAD_TEST_MODE
