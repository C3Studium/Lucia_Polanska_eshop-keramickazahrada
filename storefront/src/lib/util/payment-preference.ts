/**
 * The customer's last payment choice, remembered in the browser.
 *
 * Stored client-side (localStorage), not in cart metadata: a cart dies with the
 * order, but „platím vždycky kartou" is a fact about the person. The stored
 * value is only ever a *preselection* — every checkout still shows the choice,
 * still validates it against what is currently on offer, and still requires the
 * explicit confirm click. If the stored method no longer exists (or the browser
 * forbids storage), the flows behave exactly as before.
 *
 * Convenience, not function: the checkout behaves identically without it, which puts it in the
 * „preferenční" consent category rather than the necessary one. Nothing is read or written until
 * the visitor has allowed that category, and forgetLastPaymentMethod drops what was already stored
 * the moment they take that permission back.
 */

import { hasConsentFor } from "@lib/util/cookie-consent"

const STORAGE_KEY = "kz_last_payment_method"

export const readLastPaymentMethod = (): string | null => {
  if (typeof window === "undefined") return null
  if (!hasConsentFor("preferences")) return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value && value.trim() ? value : null
  } catch {
    // Private mode / blocked storage — a preference, not a requirement.
    return null
  }
}

export const rememberLastPaymentMethod = (optionId: string) => {
  if (typeof window === "undefined" || !optionId) return
  if (!hasConsentFor("preferences")) return
  try {
    window.localStorage.setItem(STORAGE_KEY, optionId)
  } catch {
    // Nothing to do — next visit simply starts unselected again.
  }
}

/** Called when „preferenční" consent is withdrawn — the stored value has to go with it. */
export const forgetLastPaymentMethod = () => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage that cannot be read cannot be holding anything either.
  }
}
