"use client"

import { useMotionValue, useMotionValueEvent, useSpring } from "framer-motion"
import { useEffect, useRef } from "react"

import { useSiteReducedMotion } from "@lib/context/MotionPreferenceProvider"
/**
 * Makes a horizontally-scrolling rail feel like an object rather than a scrollbar.
 *
 * Wheel (vertical or horizontal) moves the rail through a spring; a mouse or pen drags it; a
 * finger scrolls it natively. Under `prefers-reduced-motion` the spring is bypassed.
 *
 * Tažení vs. najetí (20. 11. 2026, Matěj: „tažení je zabugované, odliš, kdy
 * táhnu a kdy jen najíždím"):
 * - prohlížeč si u obrázku nebo odkazu spouštěl VLASTNÍ přetahování (průsvitný
 *   obrázek pod myší) a tím tažení pásu přerušil (`pointercancel`) — teď se
 *   `dragstart` v pásu zakazuje;
 * - tažení začne až po 6 px vodorovně (a víc do strany než nahoru/dolů);
 *   do té doby je to obyčejné najetí a klik na kartu funguje;
 * - během tažení má pás `data-dragging`: ruka „grabbing" a karty pod myší
 *   nereagují na najetí (CSS), takže se netřepou;
 * - setrvačnost jen z pohybu posledních ~80 ms — puštění po zastavení
 *   pás nevystřelí;
 * - posun prstem nebo `scrollTo` zvenku se do pružiny propíše, takže další
 *   kolečko nezačne ze staré polohy a pás neposkočí.
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

    /* Pružina i cíl na skutečnou polohu (po prstu, po `scrollTo`). */
    const syncTo = (value: number) => {
      target.jump(value)
      smooth.jump(value)
    }

    const handleWheel = (event: WheelEvent) => {
      if (maxScroll() <= 0) return

      // Trackpads send deltaX; mice send deltaY. Either should move the rail.
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY

      if (!delta) return

      event.preventDefault()

      if (reduceMotion) {
        el.scrollLeft = clamp(el.scrollLeft + delta)
        syncTo(el.scrollLeft)
        return
      }

      target.set(clamp(target.get() + delta))
    }

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let startScroll = 0
    let moved = false
    /* Posledních pár bodů pohybu pro setrvačnost: [čas, x]. */
    let samples: [number, number][] = []

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (maxScroll() <= 0) return
      // Dotyk roluje pás nativně — tažení je jen pro myš a pero.
      if (event.pointerType === "touch") return

      moved = false
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      startScroll = el.scrollLeft
      samples = [[event.timeStamp, event.clientX]]
      /*
       * Ukazatel se NEchytá hned při stisku (16. 11. 2026): se
       * `setPointerCapture` tady dostal klik celý pás místo odkazu karty.
       * Chytá se až v pohybu, když je to opravdu tažení.
       */
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return

      const dx = event.clientX - startX
      const dy = event.clientY - startY

      if (!moved) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return
        moved = true
        isDragging.current = true
        try {
          el.setPointerCapture(event.pointerId)
        } catch {
          /* Starší prohlížeč bez zachycení — tažení jede i tak, jen ne mimo pás. */
        }
        el.dataset.dragging = "true"
        smooth.jump(el.scrollLeft)
      }

      event.preventDefault()
      samples.push([event.timeStamp, event.clientX])
      if (samples.length > 6) samples.shift()
      el.scrollLeft = clamp(startScroll - dx)
    }

    const endDrag = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return
      pointerId = null

      if (!moved) return

      isDragging.current = false
      delete el.dataset.dragging

      /* Rychlost jen z pohybu posledních 80 ms; po zastavení žádný výstřel. */
      const now = event.timeStamp
      const recent = samples.filter(([time]) => now - time < 80)
      let velocity = 0
      if (recent.length >= 2) {
        const [t0, x0] = recent[0]
        const [t1, x1] = recent[recent.length - 1]
        velocity = t1 > t0 ? (x0 - x1) / (t1 - t0) : 0 // px za ms, kladná = doprava
      }

      syncTo(el.scrollLeft)
      if (!reduceMotion && velocity) {
        target.set(clamp(el.scrollLeft + velocity * 220))
      }
    }

    // A drag that ends on a card must not also open that card.
    const suppressClickAfterDrag = (event: MouseEvent) => {
      if (!moved) return
      event.preventDefault()
      event.stopPropagation()
      moved = false
    }

    /* Vlastní přetahování obrázků a odkazů by tažení pásu přerušilo. */
    const preventNativeDrag = (event: DragEvent) => event.preventDefault()

    const syncFromNativeScroll = () => {
      if (isDragging.current) return
      /* Pružina sama píše scrollLeft = smooth; jiná poloha = prst nebo scrollTo. */
      if (Math.abs(el.scrollLeft - smooth.get()) > 2 && !smooth.isAnimating()) {
        syncTo(el.scrollLeft)
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    el.addEventListener("pointerdown", handlePointerDown)
    el.addEventListener("pointermove", handlePointerMove)
    el.addEventListener("pointerup", endDrag)
    el.addEventListener("pointercancel", endDrag)
    el.addEventListener("click", suppressClickAfterDrag, true)
    el.addEventListener("dragstart", preventNativeDrag)
    el.addEventListener("scroll", syncFromNativeScroll, { passive: true })

    return () => {
      el.removeEventListener("wheel", handleWheel)
      el.removeEventListener("pointerdown", handlePointerDown)
      el.removeEventListener("pointermove", handlePointerMove)
      el.removeEventListener("pointerup", endDrag)
      el.removeEventListener("pointercancel", endDrag)
      el.removeEventListener("click", suppressClickAfterDrag, true)
      el.removeEventListener("dragstart", preventNativeDrag)
      el.removeEventListener("scroll", syncFromNativeScroll)
    }
  }, [reduceMotion, smooth, target])

  return ref
}
