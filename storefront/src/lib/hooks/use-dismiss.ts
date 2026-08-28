"use client"

import { useEffect, useRef, type RefObject } from "react"

/**
 * Close on a press outside, or on Escape.
 *
 * The overlays that are built as overlays — the search panel, the mobile menu, the E-shop menu —
 * each render a backdrop element that closes them when it is pressed. The ones that are built as
 * dropdowns do not: they hang off a control, cover part of the page, and closed themselves on
 * `mouseleave`. That is an event a finger never sends, so on a phone they stayed open until
 * something else was tapped — and with both controls now in the bottom bar, that is most of what
 * a visitor tries to do next.
 *
 * `pointerdown`, not `click`: it fires before focus moves and before a scroll can begin, so the
 * panel is already closing as the finger lands rather than after it lifts. One listener covers
 * mouse, touch and pen.
 *
 * The capture phase is deliberate too — a handler inside the page that stops propagation should
 * not be able to keep a dropdown open over the top of it.
 *
 * @param isOpen  Listeners are only attached while this is true.
 * @param onDismiss  Called on an outside press or Escape. Keep it stable or accept re-binding.
 * @returns A ref for the element that counts as "inside" — the panel *and* its trigger, so the
 *          trigger's own click still toggles rather than being read as an outside press.
 */
export function useDismiss<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onDismiss: () => void
): RefObject<T | null> {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      const target = event.target

      if (!container || !(target instanceof Node)) return

      /* A node already removed from the document — the click that removed it, for instance —
         reports as outside. Nothing to close on. */
      if (!target.isConnected) return

      if (!container.contains(target)) {
        onDismiss()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss()
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen, onDismiss])

  return containerRef
}
