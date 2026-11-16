"use client"

import { useMotionValue, useMotionValueEvent, useSpring } from "framer-motion"
import { useEffect, useRef } from "react"

import { useSiteReducedMotion } from "@lib/context/MotionPreferenceProvider"
/**
 * Makes a horizontally-scrolling rail feel like an object rather than a scrollbar.
 *
 * Three things the native container did not do: a vertical wheel moved the page instead of the
 * rail, the rail could not be dragged, and releasing a drag stopped dead. Position is driven
 * through a spring so both wheel and drag settle with the site's easing; under
 * `prefers-reduced-motion` the spring is bypassed and the rail scrolls instantly.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const target = useMotionValue(0)
  const reduceMotion = useSiteReducedMotion()
  const smooth = useSpring(target, { stiffness: 220, damping: 34, mass: 0.7 })
  const isDragging = useRef(false)

  useMotionValueEvent(smooth, "change", (value) => {
    const el = ref.current
    // While the pointer is down the element is the source of truth, not the spring.
    if (el && !isDragging.current && !reduceMotion) {
      el.scrollLeft = value
    }
  })

  useEffect(() => {
    const el = ref.current

    if (!el) {
      return
    }

    const maxScroll = () => Math.max(0, el.scrollWidth - el.clientWidth)
    const clamp = (value: number) => Math.min(Math.max(value, 0), maxScroll())

    const handleWheel = (event: WheelEvent) => {
      if (maxScroll() <= 0) return

      // Trackpads send deltaX; mice send deltaY. Either should move the rail.
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY

      if (!delta) return

      event.preventDefault()

      if (reduceMotion) {
        el.scrollLeft = clamp(el.scrollLeft + delta)
        target.jump(el.scrollLeft)
        return
      }

      target.set(clamp(target.get() + delta))
    }

    let pointerId: number | null = null
    let startX = 0
    let startScroll = 0
    let lastX = 0
    let velocity = 0
    let moved = false

    const handlePointerDown = (event: PointerEvent) => {
      // The rail is mostly product links, so a drag has to be able to start on one. The click
      // is suppressed below only once the pointer has actually travelled.
      if (event.button !== 0) return
      if (maxScroll() <= 0) return
      // Dotyk roluje pás nativně — tažení je jen pro myš a pero.
      if (event.pointerType === "touch") return

      moved = false

      pointerId = event.pointerId
      isDragging.current = true
      startX = event.clientX
      lastX = event.clientX
      startScroll = el.scrollLeft
      velocity = 0
      /*
       * Ukazatel se NEchytá hned při stisku (16. 11. 2026, Matěj: „na kartu
       * nejde kliknout"). Se `setPointerCapture` tady dostal puštění — a tím
       * i klik — celý pás místo odkazu karty, takže klik na výrobek nikam
       * nevedl. Chytá se až v pohybu, když je to opravdu tažení (> 4 px).
       */
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging.current || event.pointerId !== pointerId) return

      velocity = lastX - event.clientX
      lastX = event.clientX

      if (!moved && Math.abs(event.clientX - startX) > 4) {
        moved = true
        el.setPointerCapture(event.pointerId)
        el.dataset.dragging = "true"
      }
      if (!moved) return

      el.scrollLeft = clamp(startScroll - (event.clientX - startX))
    }

    const endDrag = (event: PointerEvent) => {
      if (!isDragging.current || event.pointerId !== pointerId) return

      isDragging.current = false
      pointerId = null
      delete el.dataset.dragging
      // Hand the release velocity to the spring so the rail carries a little momentum.
      target.jump(el.scrollLeft)
      target.set(clamp(el.scrollLeft + velocity * (reduceMotion ? 0 : 8)))
    }

    // A drag that ends on a card must not also open that card.
    const suppressClickAfterDrag = (event: MouseEvent) => {
      if (!moved) return
      event.preventDefault()
      event.stopPropagation()
      moved = false
    }

    const syncFromNativeScroll = () => {
      if (!isDragging.current) return
      target.jump(el.scrollLeft)
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    el.addEventListener("pointerdown", handlePointerDown)
    el.addEventListener("pointermove", handlePointerMove)
    el.addEventListener("pointerup", endDrag)
    el.addEventListener("pointercancel", endDrag)
    el.addEventListener("click", suppressClickAfterDrag, true)
    el.addEventListener("scroll", syncFromNativeScroll, { passive: true })

    return () => {
      el.removeEventListener("wheel", handleWheel)
      el.removeEventListener("pointerdown", handlePointerDown)
      el.removeEventListener("pointermove", handlePointerMove)
      el.removeEventListener("pointerup", endDrag)
      el.removeEventListener("pointercancel", endDrag)
      el.removeEventListener("click", suppressClickAfterDrag, true)
      el.removeEventListener("scroll", syncFromNativeScroll)
    }
  }, [reduceMotion, target])

  return ref
}
