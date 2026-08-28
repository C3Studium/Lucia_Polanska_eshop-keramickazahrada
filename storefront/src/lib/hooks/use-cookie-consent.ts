"use client"

import { useEffect, useState } from "react"

import {
  currentChoice,
  DENY_ALL,
  subscribeToConsent,
  type ConsentChoice,
  type OptionalCategory,
} from "@lib/util/cookie-consent"

/**
 * The live consent choice, for anything that must appear or disappear the moment the visitor
 * changes it (a third-party embed, an analytics script).
 *
 * Server render and first paint report {@link DENY_ALL}: the cookie is only readable on the client,
 * and rendering a consented state that the visitor may not have given — even for one frame — is the
 * thing the whole mechanism exists to prevent.
 */
export function useCookieConsent(): ConsentChoice {
  const [choice, setChoice] = useState<ConsentChoice>(DENY_ALL)

  useEffect(() => {
    setChoice(currentChoice())

    return subscribeToConsent(({ preferences, analytics, marketing }) =>
      setChoice({ preferences, analytics, marketing })
    )
  }, [])

  return choice
}

/** Single-category shorthand for the common `if (allowed) render the embed` call site. */
export function useConsentFor(category: OptionalCategory): boolean {
  return useCookieConsent()[category]
}
