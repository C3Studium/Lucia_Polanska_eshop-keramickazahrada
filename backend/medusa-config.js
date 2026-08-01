import { loadEnv, Modules, defineConfig } from '@medusajs/framework/utils';
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
  STOREFRONT_URL,
  SANITY_API_TOKEN,
  SANITY_PROJECT_ID,
  SANITY_STUDIO_URL,
  SEGMENT_WRITE_KEY,
  COMGATE_MERCHANT,
  COMGATE_SECRET,
  COMGATE_TEST,
  COMGATE_COUNTRY,
  COMGATE_CURRENCY,
  COMGATE_METHOD
} from 'lib/constants';

loadEnv(process.env.NODE_ENV, process.cwd());

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
    storefrontUrl: STOREFRONT_URL,
    backendUrl: BACKEND_URL,

    disable: SHOULD_DISABLE_ADMIN,
  },
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
            resolve: "./src/modules/ceskaPostaFulfillment",
            id: "ceska-posta-fulfillment",
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
      resolve: "./src/modules/bundled-product",
    },
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
    ...(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL || RESEND_API_KEY && RESEND_FROM_EMAIL ? [{
      key: Modules.NOTIFICATION,
      resolve: '@medusajs/notification',
      options: {
        providers: [
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
    }] : []),
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

export default defineConfig(medusaConfig);
