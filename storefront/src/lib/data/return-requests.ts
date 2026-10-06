"use server"

import { sdk } from "@lib/config"
import type { CommissionUpload } from "@lib/util/made-to-order"

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
  /** Druh žádosti — ať backend zná typ i bez parsování textu (filtr + lhůta). */
  kind?: "reklamace" | "vraceni" | "odstoupeni"
  reason: string
  /** Fotky vady (base64) — zákazník ukáže, co je špatně. Backend je nahraje po ověření vlastnictví. */
  photos?: CommissionUpload[]
}): Promise<{ success: boolean; message?: string }> {
  try {
    await sdk.client.fetch(`/store/return-requests`, {
      method: "POST",
      body: {
        order_display_id: input.order_display_id,
        email: input.email,
        ...(input.kind ? { kind: input.kind } : {}),
        reason: input.reason.trim(),
        ...(input.photos?.length ? { photos: input.photos } : {}),
      },
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, message: toCzechErrorMessage(error?.message) }
  }
}
