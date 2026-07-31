"use client"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { useEffect } from "react"

export default function ScrollToTopOnReload() {
  useEffect(() => {
    const navEntries = performance.getEntriesByType("navigation")
    let navType: string | number | undefined

    if (navEntries.length > 0 && "type" in navEntries[0]) {
      navType = (navEntries[0] as PerformanceNavigationTiming).type
    } else if (
      typeof window !== "undefined" &&
      "navigation" in window.performance
    ) {
      const legacyNav = window.performance.navigation as PerformanceNavigation
      navType = legacyNav.type
    }

    // Only scroll to top if there's no hash in the URL
    if ((navType === "reload" || navType === 1) && !window.location.hash) {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual"
      }
      scrollWithLenis(0, { immediate: true })
    }
  }, [])
  return null
}
