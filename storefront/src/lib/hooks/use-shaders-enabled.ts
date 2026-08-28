"use client"

import { useEffect, useState } from "react"

import {
  probeShaderCapability,
  type ShaderVerdict,
} from "@lib/util/shader-capability"

/**
 * The one switch that decides whether any WebGL shader is allowed to run.
 *
 * Every shader on the site asks this and nothing else: the three image shaders (which all funnel
 * through FAQImageShader — the homepage hero, the FAQ stage and the about hero), the ambient
 * LiquidEther behind every page, and the Courses liquid carousel. Each of them already ships a
 * static image underneath, so switching this off is a fallback, not a hole.
 *
 * The answer comes in two parts, and the switch can flip from the first to the second while the
 * page is open:
 *
 *   1. A static probe, before anything is drawn — lib/util/shader-capability.ts. Touch devices,
 *      software rasterisers, the integrated parts that are demonstrably below the memory line,
 *      and machines whose OS has asked for less motion or less data all fail here and never
 *      mount a context at all.
 *
 *   2. A runtime watchdog, below. Hardware identification can only ever be a proxy, and the
 *      thing the proxy is standing in for — will this machine actually hold a frame rate — is
 *      directly measurable once the shaders are running. A machine that passes the probe and
 *      then stutters gets the shaders taken away, permanently for the session.
 *
 * Server render and first paint report `false`. Starting optimistic would mount a WebGL context
 * on the client's machine and tear it down a frame later, which is the exact cost being avoided;
 * starting pessimistic just means the static image shows first and the canvas fades in over it,
 * which is what the `.is-ready` transition in the shader stylesheets already does on every load.
 */
export function useShadersEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const allowed = resolveVerdict()
    setEnabled(allowed)

    /* Started here rather than in resolveVerdict, because this hook is what a real shader calls.
       The watchdog measures whether the machine is holding a frame rate WHILE the expensive thing
       runs; starting it from the stamp-only path would time a page with nothing on it, conclude
       the machine is fine, and stop before the shader it was meant to be judging ever mounted. */
    if (allowed) startWatchdog()

    /* The watchdog can demote long after mount, so every consumer stays subscribed for as long
       as it is on the page rather than reading the verdict once. */
    return subscribe(setEnabled)
  }, [])

  return enabled
}

/**
 * Stamp the effect budget onto <html> without claiming a shader.
 *
 * Mounted once in the root layout. Without it, `data-fx` only ever appeared on pages that
 * happened to contain a shader — GlobalLiquidEther was the sole caller of the hook above — so
 * the `reduced-fx` mixin silently never matched anywhere else. The root 404 is the plain case:
 * it renders outside the (main) layout, has no ambient canvas, and was shipping unstamped.
 *
 * Deliberately does not start the watchdog. See the comment in useShadersEnabled.
 */
export function useEffectBudgetFlag(): void {
  useEffect(() => {
    resolveVerdict()
  }, [])
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────
   Session state. The probe allocates a WebGL context, so it runs once per page load and every
   later caller reads the cached answer; nothing it measures changes while the tab is open.
   ───────────────────────────────────────────────────────────────────────────────────────────── */

let cachedVerdict: ShaderVerdict | undefined
let demoted = false
const listeners = new Set<(enabled: boolean) => void>()

/**
 * A demotion outlives the page it happened on.
 *
 * Without this, every client-side navigation re-runs the static probe, passes it again — the
 * hardware has not changed — and mounts the shader back onto a machine that has already been
 * measured failing to render it. The visitor would get one stuttering hero per route.
 */
const SESSION_KEY = "kz:shaders-demoted"

/**
 * Run the probe once, remember it, and put the answer on <html>. Idempotent — every later caller
 * reads the cached verdict, and the WebGL context the probe allocates is created exactly once.
 */
function resolveVerdict(): boolean {
  if (cachedVerdict === undefined) {
    cachedVerdict = probeShaderCapability()

    if (cachedVerdict.allowed && readDemotion()) {
      demoted = true
    }

    stampDocument()
  }

  return cachedVerdict.allowed && !demoted
}

function subscribe(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function demote(reason: string) {
  if (demoted) return

  demoted = true
  writeDemotion()
  stampDocument(reason)

  listeners.forEach((listener) => listener(false))
}

/**
 * The verdict, on the document element, for CSS.
 *
 * A stylesheet can already ask whether it is on a touch device — that is the `touch` mixin — but
 * it has no way to ask any of the rest of this, and CSS owns plenty of expensive work of its own:
 * `backdrop-filter`, large `filter: blur()`, infinite keyframes. `[data-fx="reduced"]` is the
 * hook that lets those turn themselves off on exactly the machines the shaders turned off for.
 * See the `reduced-fx` mixin in styles/system/_mixins.scss.
 *
 * `data-fx-reason` is diagnostic only: nothing styles off it, and it exists so that a device that
 * behaves unexpectedly in the wild can be explained from a screenshot of its dev tools.
 */
function stampDocument(runtimeReason?: string) {
  if (typeof document === "undefined") return

  const root = document.documentElement
  const allowed = (cachedVerdict?.allowed ?? false) && !demoted

  root.dataset.fx = allowed ? "full" : "reduced"
  root.dataset.fxReason = runtimeReason ?? cachedVerdict?.reason ?? "unknown"
}

function readDemotion(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1"
  } catch {
    /* Private mode, or storage disabled. Not knowing costs one measurement, not correctness. */
    return false
  }
}

function writeDemotion() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1")
  } catch {
    /* As above — the in-memory `demoted` flag still holds for this page. */
  }
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────
   The runtime watchdog.
   ───────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Frames are ignored for this long after the shaders mount. Shader compilation, the first
 * texture uploads and the page's own hydration all land in this window, and none of them say
 * anything about the frame rate the machine will settle at.
 */
const WARMUP_MS = 900

/** Frames per judged window. At 60fps this is a shade over a second — long enough that a single
    garbage collection cannot fill it, short enough to act before the visitor has scrolled. */
const WINDOW_FRAMES = 64

/**
 * The line, as a frame time. 40ms is 25fps.
 *
 * Set against the median of the window, not the mean, so that one 300ms hitch — an image decode,
 * a font swap, the tab being dragged to another monitor — cannot demote a machine that is
 * otherwise holding 60. A 30Hz panel reports 33ms and stays comfortably clear of this.
 */
const SLOW_FRAME_MS = 40

/** Consecutive bad windows required. Two is roughly two seconds of sustained stutter. */
const BAD_WINDOWS_TO_DEMOTE = 2

/**
 * Watching stops here if the machine is coping. The shaders run for as long as the visitor stays
 * on the site, but a rAF loop that never ends is itself a cost, and a machine that has held 60fps
 * for eight seconds has answered the question.
 */
const WATCH_BUDGET_MS = 8000

let watching = false

function startWatchdog() {
  if (watching || typeof window === "undefined") return
  if (typeof window.requestAnimationFrame !== "function") return

  watching = true

  const started = performance.now()
  let frames: number[] = []
  let badWindows = 0
  let last = performance.now()
  let handle = 0

  /* A backgrounded tab throttles rAF to once a second or stops it entirely, which would read as
     a catastrophically slow machine. Every sample taken across a visibility change is discarded
     rather than merely skipped, because the frame that resumes is also long. */
  const reset = () => {
    frames = []
    badWindows = 0
    last = performance.now()
  }

  const stop = () => {
    watching = false
    cancelAnimationFrame(handle)
    document.removeEventListener("visibilitychange", onVisibility)
  }

  function onVisibility() {
    if (document.hidden) {
      frames = []
    } else {
      reset()
    }
  }

  const tick = (now: number) => {
    const delta = now - last
    last = now

    if (document.hidden || now - started < WARMUP_MS) {
      handle = requestAnimationFrame(tick)
      return
    }

    frames.push(delta)

    if (frames.length >= WINDOW_FRAMES) {
      if (median(frames) > SLOW_FRAME_MS) {
        badWindows += 1

        if (badWindows >= BAD_WINDOWS_TO_DEMOTE) {
          stop()
          demote("runtime-frame-budget")
          return
        }
      } else {
        /* One good window clears the count. The target is sustained stutter, not a rough patch. */
        badWindows = 0
      }

      frames = []
    }

    if (now - started > WATCH_BUDGET_MS && badWindows === 0) {
      stop()
      return
    }

    handle = requestAnimationFrame(tick)
  }

  document.addEventListener("visibilitychange", onVisibility)
  handle = requestAnimationFrame(tick)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
