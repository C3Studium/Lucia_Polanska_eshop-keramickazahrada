"use client"

import { useEffectBudgetFlag } from "@lib/hooks/use-shaders-enabled"

/**
 * Puts `data-fx="full" | "reduced"` on <html>, on every page, and renders nothing.
 *
 * The stamp used to be a side effect of GlobalLiquidEther asking whether it was allowed to run,
 * which meant it only landed on pages that already had a shader. Anything rendering outside the
 * (main) layout — the root 404 is the one that caught this — shipped with the attribute absent,
 * so every `@include reduced-fx` rule on it was dead. Mounting this in the root layout makes the
 * effect budget a fact about the document rather than a by-product of one component.
 *
 * Cheap: the probe behind it runs once per page load and caches, and this does not start the
 * frame-rate watchdog — that belongs with the components actually doing expensive work.
 */
export default function EffectBudgetFlag() {
  useEffectBudgetFlag()

  return null
}
