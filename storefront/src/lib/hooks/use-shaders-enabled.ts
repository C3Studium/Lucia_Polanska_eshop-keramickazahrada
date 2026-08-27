"use client"

import { useEffect, useState } from "react"

/**
 * The one switch that decides whether any WebGL shader is allowed to run.
 *
 * Every shader on the site asks this and nothing else: the three image shaders (which all funnel
 * through FAQImageShader — the homepage hero, the FAQ stage and the about hero), the ambient
 * LiquidEther behind every page, and the Courses liquid carousel. Each of them already ships a
 * static image underneath, so switching this off is a fallback, not a hole.
 *
 * TEMPORARY, AND DELIBERATELY CRUDE: it is keyed off the operating system being Windows, because
 * that is the machine we know stutters. Windows is not a performance axis — a Surface Go and an
 * RTX 4090 both answer "Windows", so a strong Windows PC is needlessly downgraded and a loaded
 * MacBook is not. The right key is measured capability: renderer string via WEBGL_debug_renderer_info,
 * a few frames of rAF timing at startup, hardwareConcurrency, deviceMemory, or the saveData hint.
 * When that lands it replaces the body of this function and every call site stays as it is.
 *
 * Server render and first paint report `false`. Starting optimistic would mount a WebGL context
 * on the client's machine and tear it down a frame later, which is the exact cost being avoided;
 * starting pessimistic just means the static image shows first and the canvas fades in over it,
 * which is what the `.is-ready` transition in the shader stylesheets already does on every load.
 */
export function useShadersEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(!isWindows())
  }, [])

  return enabled
}

function isWindows(): boolean {
  if (typeof navigator === "undefined") return false

  /* userAgentData is the non-frozen source and is present in the Chrome the client uses. The UA
     string is the fallback for Safari and Firefox, which do not implement it. */
  const platform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform

  if (platform) return platform === "Windows"

  return /Windows|Win32|Win64|WOW64/i.test(navigator.userAgent)
}
