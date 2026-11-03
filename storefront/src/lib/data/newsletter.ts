"use server"

import { sdk } from "@lib/config"

/**
 * Subscribes an address to the atelier newsletter.
 *
 * Mirrors `subscribeToRestock` in `products.ts`: the shared SDK client sends
 * the publishable key with the request. The backend upserts quietly — it
 * answers `{ ok: true }` whether the address is new, returning, or already
 * subscribed, so nothing about the list leaks to the form.
 *
 * Errors come back as `{ ok: false }` rather than a throw: a thrown server
 * action error is masked in production, and the footer only needs to know
 * whether to show its one Czech error line.
 */
export const subscribeToNewsletter = async ({
  email,
  countryCode,
}: {
  email: string
  /** Země z přepínače — backend podle ní zvolí jazyk potvrzovacího e-mailu. */
  countryCode?: string | null
}): Promise<{ ok: boolean }> => {
  const country = (countryCode ?? "").trim().toLowerCase()
  try {
    await sdk.client.fetch(`/store/newsletter`, {
      method: "POST",
      body: /^[a-z]{2}$/.test(country) ? { email, country_code: country } : { email },
      cache: "no-store",
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
