type ScrollTarget = number | string | HTMLElement

type ScrollWithLenisOptions = {
  duration?: number
  immediate?: boolean
  offset?: number
  onComplete?: () => void
}

const defaultEasing = (value: number) =>
  Math.min(1, 1.001 - Math.pow(2, -10 * value))

/** Resolves the target's own `scroll-margin-top`, falling back to the global section value. */
const scrollMarginTopOf = (target: ScrollTarget) => {
  if (typeof window === "undefined" || typeof target === "number") return 0

  const element =
    typeof target === "string" ? document.querySelector<HTMLElement>(target) : target

  if (!element) return 0

  const declared = window.getComputedStyle(element).scrollMarginTop
  const parsed = Number.parseFloat(declared)

  return Number.isFinite(parsed) ? parsed : 0
}

export const scrollWithLenis = (
  target: ScrollTarget,
  options: ScrollWithLenisOptions = {}
) => {
  if (typeof window === "undefined") return

  const { duration = 1.2, immediate = false, onComplete } = options
  // The declared `scroll-margin-top` was ignored because Lenis was always passed offset 0,
  // so every anchor landed underneath the fixed navbar. Read it from the target instead.
  const offset = options.offset ?? -scrollMarginTopOf(target)

  if (window.lenis) {
    window.lenis.scrollTo(target, {
      duration,
      easing: defaultEasing,
      immediate,
      offset,
      onComplete,
    })
    return
  }

  const fallbackTarget =
    typeof target === "string" ? document.querySelector(target) : target
  const top =
    typeof fallbackTarget === "number"
      ? fallbackTarget
      : fallbackTarget instanceof HTMLElement
      ? fallbackTarget.getBoundingClientRect().top + window.scrollY + offset
      : 0

  window.scrollTo({
    top,
    behavior: immediate ? "auto" : "smooth",
  })
  onComplete?.()
}
