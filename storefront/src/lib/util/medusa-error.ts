import { toCzechErrorMessage } from "./error-messages"

/**
 * The single place backend failures become customer-facing text.
 *
 * Every `@lib/data` call funnels through here, so translating once is enough — previously this
 * capitalised the backend's English and rethrew it, which is how "Cart with id … was not found."
 * reached a Czech customer mid-checkout. The raw message is still logged for us; only the
 * translated one is thrown.
 */
export default function medusaError(error: any): never {
  if (error?.response) {
    const data = error.response.data
    let raw: string

    if (typeof data === "string") {
      raw = data
    } else if (data && typeof data.message === "string") {
      raw = data.message
    } else if (data && typeof data.error === "string") {
      raw = data.error
    } else {
      try {
        raw = JSON.stringify(data)
      } catch {
        raw = ""
      }
    }

    // Server-side diagnostics keep the original; headers are not logged — they carry auth.
    console.error(
      `[medusa] ${error.response.status} ${error?.config?.url ?? ""}: ${raw}`
    )

    throw new Error(toCzechErrorMessage(raw))
  }

  if (error?.request) {
    throw new Error(toCzechErrorMessage("No response received from server"))
  }

  const message = error?.message || ""
  console.error(`[medusa] request setup failed: ${message}`)
  throw new Error(toCzechErrorMessage(message))
}
