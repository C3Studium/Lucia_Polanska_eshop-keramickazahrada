"use server"

import { revalidateTag } from "next/cache"

import { toCzechErrorMessage } from "@lib/util/error-messages"
import type {
  CommissionCancellation,
  CommissionCancelResult,
} from "@lib/util/made-to-order"

import { getCacheTag } from "./cookies"
import { cancelCommission, getCommissionCancellation } from "./made-to-order"

/**
 * Zrušení zakázky zákazníkem (audit § 0, Z4/Z5) — server actions pro panel
 * zakázky v účtu a na potvrzení objednávky. Tenká vrstva nad fetchery v
 * `./made-to-order`: fázi, částky i to, zda zrušit jde, soudí backend; tady se
 * jen ptáme, posíláme a překládáme chybu do češtiny.
 *
 * `token` = podepsaný self-service token (host z e-mailu); přihlášený zákazník
 * ho nepotřebuje, JWT přibalí fetcher sám.
 */

export async function loadCommissionCancellation(
  orderId: string,
  token?: string | null
): Promise<CommissionCancellation | null> {
  return getCommissionCancellation(orderId, token)
}

export type CancelCommissionOutcome =
  | { success: true; result: CommissionCancelResult }
  | { success: false; message: string }

export async function submitCommissionCancellation(
  orderId: string,
  input: { reason?: string; token?: string | null }
): Promise<CancelCommissionOutcome> {
  try {
    const result = await cancelCommission(
      orderId,
      { reason: input.reason },
      input.token
    )

    // Detail objednávky i výpis v účtu mají ukázat „Zrušeno" hned.
    const ordersCacheTag = await getCacheTag("orders")
    if (ordersCacheTag) revalidateTag(ordersCacheTag)

    return { success: true, result }
  } catch (error: any) {
    /* 409 „už zrušeno" i jiné odmítnutí přijdou s českou větou — ta projde
       beze změny; anglické chyby Medusy se přeloží, nebo spadnou na obecnou. */
    return { success: false, message: toCzechErrorMessage(error?.message) }
  }
}
