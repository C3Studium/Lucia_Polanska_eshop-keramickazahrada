/**
 * The visitor's cookie decision — the single source of truth for every optional cookie.
 *
 * Nezbytné cookies (cart, session, region, CSRF) are never part of the decision: the shop cannot
 * run without them and GDPR does not require consent for them. Everything else is off until the
 * visitor says otherwise, which is why the defaults below deny rather than grant.
 *
 * Stored in a cookie rather than localStorage, for three reasons: it expires on its own (a consent
 * record is not permanent — after {@link CONSENT_MAX_AGE_SECONDS} we have to ask again), it survives
 * in private windows that refuse localStorage, and the server can read it if a future page needs to
 * decide server-side whether to embed a third-party script at all.
 *
 * The previous informational notice stored `kz-cookie-notice-acknowledged`. That key is deliberately
 * ignored: it recorded "I read this", not consent to anything, so it cannot be upgraded into one.
 */

export type OptionalCategory = "preferences" | "analytics" | "marketing"

export type ConsentChoice = Record<OptionalCategory, boolean>

export type StoredConsent = ConsentChoice & {
  version: number
  /** ISO timestamp of the decision — what a supervisory authority asks for. */
  decidedAt: string
}

export const CONSENT_COOKIE = "kz-cookie-consent"

/** Bump when the categories change; a stored decision from an older set is re-asked, not guessed. */
export const CONSENT_VERSION = 1

/** Six months, matching the retention stated on /cookies. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182

/** Fired on `window` whenever the decision changes, with the new value in `detail`. */
export const CONSENT_CHANGE_EVENT = "kz:cookie-consent"

/** Fired on `window` to reopen the settings dialog — see {@link openCookiePreferences}. */
export const CONSENT_OPEN_EVENT = "kz:cookie-preferences"

/** "Zamítnout" — nothing beyond what the shop cannot work without. */
export const DENY_ALL: ConsentChoice = {
  preferences: false,
  analytics: false,
  marketing: false,
}

/** "Přijmout jen důležité" — the shop may remember the visitor's own choices, nothing is measured. */
export const ESSENTIAL_ONLY: ConsentChoice = {
  preferences: true,
  analytics: false,
  marketing: false,
}

/** "Přijmout vše". */
export const ACCEPT_ALL: ConsentChoice = {
  preferences: true,
  analytics: true,
  marketing: true,
}

/**
 * The stored decision, or `null` when the visitor has not decided (or decided under an older set of
 * categories, or the browser refuses cookies — all three mean "ask").
 */
export function readConsent(): StoredConsent | null {
  if (typeof document === "undefined") return null

  const raw = readCookie(CONSENT_COOKIE)

  if (!raw) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<StoredConsent>

    if (parsed?.version !== CONSENT_VERSION) return null

    return {
      version: CONSENT_VERSION,
      decidedAt:
        typeof parsed.decidedAt === "string" ? parsed.decidedAt : new Date(0).toISOString(),
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    }
  } catch {
    // A malformed cookie is not a decision.
    return null
  }
}

/** The current choice, with the deny-by-default applied when nothing is stored. */
export function currentChoice(): ConsentChoice {
  const stored = readConsent()

  if (!stored) return DENY_ALL

  return {
    preferences: stored.preferences,
    analytics: stored.analytics,
    marketing: stored.marketing,
  }
}

/**
 * Whether one optional category may run right now. This is what any future third-party script must
 * ask before it loads, and what {@link readLastPaymentMethod} already asks.
 */
export function hasConsentFor(category: OptionalCategory): boolean {
  return currentChoice()[category]
}

/**
 * Record a decision and tell the page about it. Returns the stored value so the caller can render
 * from the same object it just wrote instead of re-reading the cookie.
 */
export function saveConsent(choice: ConsentChoice): StoredConsent {
  const stored: StoredConsent = {
    ...choice,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  }

  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : ""

    document.cookie =
      `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(stored))}` +
      `; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`

    window.dispatchEvent(
      new CustomEvent<StoredConsent>(CONSENT_CHANGE_EVENT, { detail: stored })
    )
  }

  return stored
}

/**
 * Reopen the settings dialog from anywhere — the footer link, the cookies page. GDPR requires
 * consent to be as easy to withdraw as it was to give, so this has to exist outside the banner.
 */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return

  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}

/** Subscribe to decision changes; returns the unsubscribe. */
export function subscribeToConsent(
  listener: (consent: StoredConsent) => void
): () => void {
  if (typeof window === "undefined") return () => {}

  const handler = (event: Event) => {
    listener((event as CustomEvent<StoredConsent>).detail)
  }

  window.addEventListener(CONSENT_CHANGE_EVENT, handler)

  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler)
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`

  for (const part of document.cookie.split(";")) {
    const entry = part.trim()

    if (entry.startsWith(prefix)) {
      return entry.slice(prefix.length)
    }
  }

  return null
}
