"use client"

import { MotionConfig } from "framer-motion"

/**
 * Motion reductions are switched off site-wide, on purpose and for now.
 *
 * `reducedMotion="never"` makes framer-motion's `useReducedMotion()` return false everywhere and
 * stops framer applying its own automatic reductions. That single switch covers all thirteen
 * components that branched on the preference — Kurzy/Intro, IntroHero's masked lines, Sold's
 * marquee, RezervaceModal, useDragScroll, CookieNotice, Footer and the three express-checkout
 * screens — without a conditional left in any of them to drift out of sync.
 *
 * Why: the client could not see the site as designed, and half the reductions had grown into
 * the layout rather than staying decorative. The other two layers were removed alongside this
 * one: the `@include reduced-motion` block in globals.scss, and LenisProvider's early return.
 *
 * This is a stopgap and it is a real accessibility regression: a visitor who has asked their OS
 * for less motion now gets the full thing. To restore it, set this back to "user" — that alone
 * revives every one of those thirteen components, because none of their branches were deleted.
 * The CSS layer and the Lenis gate would need putting back by hand.
 */
export default function MotionPreferenceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>
}
