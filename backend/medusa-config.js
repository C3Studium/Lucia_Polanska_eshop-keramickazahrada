console.log('[Medusa Config] Starting to load medusa-config.js...')
console.log('[Medusa Config] Current working directory:', process.cwd())
console.log('[Medusa Config] NODE_ENV:', process.env.NODE_ENV)

import { loadEnv, Modules, defineConfig } from '@medusajs/framework/utils';

console.log('[Medusa Config] About to import constants from lib/constants...')
import {
  ADMIN_CORS,
  AUTH_CORS,
  BACKEND_URL,
  COOKIE_SECRET,
  DATABASE_URL,
  JWT_SECRET,
  REDIS_URL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SHOULD_DISABLE_ADMIN,
  STORE_CORS,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  WORKER_MODE,
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_BUCKET,
  JWT_EXPIRES_IN,
  SANITY_API_TOKEN,
  SANITY_PROJECT_ID,
  SANITY_STUDIO_URL,
  SEGMENT_WRITE_KEY,
  COMGATE_MERCHANT,
  COMGATE_SECRET,
  COMGATE_TEST,
  COMGATE_COUNTRY,
  COMGATE_CURRENCY,
  COMGATE_METHOD,
  BALIKOVNA_API_URL,
  BALIKOVNA_API_TOKEN,
  BALIKOVNA_API_SECRET,
  BALIKOVNA_API_CUSTOMER_ID,
  IDOKLAD_CLIENT_ID,
  IDOKLAD_CLIENT_SECRET,
  IDOKLAD_APPLICATION_ID,
  IDOKLAD_VAT_PAYER,
  IDOKLAD_NUMERIC_SEQUENCE_ID,
  IDOKLAD_TEST_MODE
} from 'lib/constants';
console.log('[Medusa Config] Constants imported successfully')
console.log('[Medusa Config] DATABASE_URL present:', !!DATABASE_URL)
console.log('[Medusa Config] JWT_SECRET present:', !!JWT_SECRET)
console.log('[Medusa Config] COOKIE_SECRET present:', !!COOKIE_SECRET)

loadEnv(process.env.NODE_ENV, process.cwd());

console.log('[Medusa Config] Environment loaded')
console.log('[Medusa Config] About to build config object...')

// Log JWT configuration at startup
const resolvedJwtExpiresIn = JWT_EXPIRES_IN || '30d'
console.log('[Medusa Config] JWT_EXPIRES_IN value:', resolvedJwtExpiresIn)

const medusaConfig = {
  projectConfig: {
    databaseUrl: DATABASE_URL,
    databaseLogging: false,
    redisUrl: REDIS_URL,
    workerMode: WORKER_MODE,
    http: {
      adminCors: ADMIN_CORS,
      authCors: AUTH_CORS,
      storeCors: STORE_CORS,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: resolvedJwtExpiresIn,
      cookieSecret: COOKIE_SECRET
    },
    build: {
      rollupOptions: {
        external: [
          "@medusajs/dashboard",
          "@medusajs/ui",
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react-router-dom",
          "@tanstack/react-query"
        ]
      }
    }
  },
  admin: {
    // The storefront origin, straight from env — `lib/constants` deliberately
    // stopped exporting a STOREFRONT_URL (see the comment there).
    storefrontUrl: process.env.STOREFRONT_PUBLIC_URL,
    backendUrl: BACKEND_URL,

    disable: SHOULD_DISABLE_ADMIN,
  },
  // Draft Orders is an official Medusa plugin, not a custom build. It was already a
  // dependency but was never registered, so its module, API routes and admin screens
  // were all inert. Registering it is what produces the `Objednávky > Draft Orders`
  // sidebar entry: the plugin's own admin extension declares `nested: "/orders"`, which
  // the dashboard appends to the core Orders item.
  plugins: [
    {
      resolve: '@medusajs/draft-order',
      options: {},
    },
  ],
  modules: [
    {
      key: Modules.FILE,
      resolve: '@medusajs/file',
      options: {
        providers: [
          ...(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY ? [{
            resolve: './src/modules/minio-file',
            id: 'minio',
            options: {
              endPoint: MINIO_ENDPOINT,
              accessKey: MINIO_ACCESS_KEY,
              secretKey: MINIO_SECRET_KEY,
              bucket: MINIO_BUCKET // Optional, default: medusa-media
            }
          }] : [{
            resolve: '@medusajs/file-local',
            id: 'local',
            options: {
              upload_dir: 'static',
              backend_url: `${BACKEND_URL}/static`
            }
          }])
        ]
      }
    },
    // Fulfillment providers
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            // The registration id is what the admin *displays*: the dashboard
            // has no name field for a provider and derives the label from the
            // second segment of `<identifier>_<id>` (`formatProvider`). With
            // both segments equal it read "Ceska Posta Fulfillment"; `balikovna`
            // makes it read "Balikovna".
            //
            // This changes the composite provider_id, so the existing
            // "Česká pošta" shipping option has to be re-pointed at the provider
            // once — see docs/TODO-carrier-account.md.
            resolve: "./src/modules/ceskaPostaFulfillment",
            id: "balikovna",
            options: {
              api_url: BALIKOVNA_API_URL,
              api_token: BALIKOVNA_API_TOKEN,
              api_secret: BALIKOVNA_API_SECRET,
              customer_id: BALIKOVNA_API_CUSTOMER_ID,
            },
          },
          {
            // Osobní odběr as its own provider — nothing here involves a
            // carrier, so listing it under Balíkovna described a journey that
            // never happens. The registration id is what the admin displays.
            resolve: "./src/modules/pickupFulfillment",
            id: "osobni-odber",
            options: {},
          },
          {
            resolve: "./src/modules/zasilkovnaFulfillment",
            id: "packeta",
            options: {},
          },
        ],
      },
    },
    {
      resolve: "./src/modules/sanity",
      options: {
        api_token: SANITY_API_TOKEN,
        project_id: SANITY_PROJECT_ID,
        api_version: new Date().toISOString().split("T")[0],
        dataset: "production",
        studio_url: SANITY_STUDIO_URL,
        type_map: {
          product: "product",
        },
      },
    },
    {
      resolve: "./src/modules/wishlist",
    },
    {
      resolve: "@medusajs/medusa/analytics",
      options: {
        providers: [
          {
            resolve: "./src/modules/segment",
            id: "segment",
            options: {
              writeKey: SEGMENT_WRITE_KEY,
            },
          },
        ],
      },
    }, 
    {
      resolve: "./src/modules/product-review",
    },
    {
      resolve: "./src/modules/restock"
    },
    {
      resolve: "./src/modules/newsletter",
    },
    {
      resolve: "./src/modules/return-request",
    },
    {
      resolve: "./src/modules/price-watch",
    },
    {
      resolve: "./src/modules/bundled-product",
    },
    {
      resolve: "./src/modules/merchant-catalog",
    },
    {
      resolve: "./src/modules/merchant-order",
    },
    {
      resolve: "./src/modules/made-to-order",
    },
    {
      // Course terms and reservations (kurzy) — see docs/kurzy-system.md.
      resolve: "./src/modules/course",
    },
    // iDoklad invoicing (FINISHINGTODOLIST §1) — registered only with
    // credentials in hand; without them every invoicing entry point degrades
    // to a logged no-op, so checkout and fulfilment never depend on it.
    ...(IDOKLAD_CLIENT_ID && IDOKLAD_CLIENT_SECRET ? [{
      resolve: "./src/modules/idoklad",
      options: {
        client_id: IDOKLAD_CLIENT_ID,
        client_secret: IDOKLAD_CLIENT_SECRET,
        application_id: IDOKLAD_APPLICATION_ID,
        vat_payer: IDOKLAD_VAT_PAYER,
        numeric_sequence_id: IDOKLAD_NUMERIC_SEQUENCE_ID,
        test_mode: IDOKLAD_TEST_MODE,
      },
    }] : []),
    ...(REDIS_URL ? [{
      key: Modules.EVENT_BUS,
      resolve: '@medusajs/medusa/event-bus-redis',
      options: {
        redisUrl: REDIS_URL
      }
    },
    {
      key: Modules.WORKFLOW_ENGINE,
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: {
        redis: {
          redisUrl: REDIS_URL,
        }
      }
    }] : []),
    // The notification module is registered unconditionally.
    //
    // It used to be registered only when an e-mail provider was configured, which
    // also took the admin's bell down with it: the bell reads the `feed` channel
    // from this same module. `@medusajs/notification-local` handles `feed` and
    // needs no configuration at all, so in-app notifications now work regardless
    // of whether e-mail is set up. E-mail providers stay conditional.
    {
      key: Modules.NOTIFICATION,
      resolve: '@medusajs/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/notification-local',
            id: 'local',
            options: {
              channels: ['feed'],
            },
          },
          ...(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL ? [{
            resolve: '@medusajs/notification-sendgrid',
            id: 'sendgrid',
            options: {
              channels: ['email'],
              api_key: SENDGRID_API_KEY,
              from: SENDGRID_FROM_EMAIL,
            }
          }] : []),
          ...(RESEND_API_KEY && RESEND_FROM_EMAIL ? [{
            resolve: './src/modules/resend',
            id: 'resend',
            options: {
              channels: ['email'],
              api_key: RESEND_API_KEY,
              from: RESEND_FROM_EMAIL,
            },
          }] : []),
        ]
      }
    },
    // Payment providers (single registration with multiple providers)
    {
      key: Modules.PAYMENT,
      resolve: '@medusajs/payment',
      options: {
        providers: [
          // Custom Comgate provider
          {
            resolve: './src/modules/comgate',
            id: 'comgate',
            options: {
              merchant: COMGATE_MERCHANT,
              secret: COMGATE_SECRET,
              test: COMGATE_TEST,
              country: COMGATE_COUNTRY,
              curr: COMGATE_CURRENCY,
              method: COMGATE_METHOD
            },
          },
          {
            // „Zaplatím při vyzvednutí" — cash taken in person at the
            // workshop. Not dobírka: no carrier is involved and D1 still
            // forbids that. It authorizes and never captures, so an order that
            // was promised but never collected can neither ship nor count as
            // revenue until she records the money (see the provider's docs).
            resolve: './src/modules/pickupPayment',
            id: 'pickup',
          },
          {
            // Dobírka — the carrier collects on delivery. Offered per product
            // and only inside Czechia; see the module's own note about this
            // reversing a previously standing rule.
            resolve: './src/modules/dobirkaPayment',
            id: 'ceska-posta',
            options: {},
          },
          // Stripe provider (conditionally enabled if env present)
          ...(STRIPE_API_KEY && STRIPE_WEBHOOK_SECRET ? [{
            resolve: '@medusajs/payment-stripe',
            id: 'stripe',
            options: {
              apiKey: STRIPE_API_KEY,
              webhookSecret: STRIPE_WEBHOOK_SECRET,
            },
          }] : []),
        ],
      },
    },
  ]
};

console.log('[Medusa Config] Config object created successfully')
console.log('[Medusa Config] About to export with defineConfig...')

export default defineConfig(medusaConfig);
