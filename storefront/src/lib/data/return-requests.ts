"use server"

import { sdk } from "@lib/config"

import { toCzechErrorMessage } from "@lib/util/error-messages"

/**
 * Returns and complaints. The backend e-mails the customer a confirmation and notifies the
 * owner; when she decides it sends the approval or rejection itself — the storefront sends
 * nothing and does not model the outcome.
 */
export async function submitReturnRequest(input: {
  order_id: string
  email: string
  reason: string
  customer_name?: string
}): Promise<{ success: boolean; message?: string }> {
  try {
    await sdk.client.fetch(`/store/return-requests`, {
      method: "POST",
      body: {
        order_id: input.order_id,
        email: input.email,
        reason: input.reason.trim(),
        ...(input.customer_name ? { customer_name: input.customer_name } : {}),
      },
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, message: toCzechErrorMessage(error?.message) }
  }
}
