"use server"

import { sdk } from "@lib/config"

import { toCzechErrorMessage } from "@lib/util/error-messages"

/**
 * Returns and complaints. The backend e-mails the customer a confirmation and notifies the
 * owner; when she decides it sends the approval or rejection itself — the storefront sends
 * nothing and does not model the outcome.
 */
export async function submitReturnRequest(input: {
  /** Číslo objednávky jak je na potvrzení (display_id) — backend ověřuje vlastnictví přes číslo + e-mail. */
  order_display_id: string
  email: string
  reason: string
}): Promise<{ success: boolean; message?: string }> {
  try {
    await sdk.client.fetch(`/store/return-requests`, {
      method: "POST",
      body: {
        order_display_id: input.order_display_id,
        email: input.email,
        reason: input.reason.trim(),
      },
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, message: toCzechErrorMessage(error?.message) }
  }
}
