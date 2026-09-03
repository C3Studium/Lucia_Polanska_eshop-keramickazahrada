import Medusa from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

// Prefer server-side URL, then public URL
if (process.env.MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL
} else if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

// Normalize (no trailing slash)
MEDUSA_BACKEND_URL = MEDUSA_BACKEND_URL.replace(/\/$/, "")

/**
 * Where the backend lives — exported because the admin bar links back into
 * the Medusa dashboard, which is served from that same origin.
 */
export const backendUrl = MEDUSA_BACKEND_URL

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
