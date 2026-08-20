/**
 * The customer's last payment choice, remembered in the browser.
 *
 * Stored client-side (localStorage), not in cart metadata: a cart dies with the
 * order, but „platím vždycky kartou" is a fact about the person. The stored
 * value is only ever a *preselection* — every checkout still shows the choice,
 * still validates it against what is currently on offer, and still requires the
 * explicit confirm click. If the stored method no longer exists (or the browser
 * forbids storage), the flows behave exactly as before.
 */

const STORAGE_KEY = "kz_last_payment_method"

export const readLastPaymentMethod = (): string | null => {
  if (typeof window === "undefined") return null
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
  try {
    window.localStorage.setItem(STORAGE_KEY, optionId)
  } catch {
    // Nothing to do — next visit simply starts unselected again.
  }
}
