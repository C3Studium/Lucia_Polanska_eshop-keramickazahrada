type ScrollTarget = number | string | HTMLElement

type ScrollWithLenisOptions = {
  duration?: number
  immediate?: boolean
  offset?: number
  onComplete?: () => void
}

const defaultEasing = (value: number) =>
  Math.min(1, 1.001 - Math.pow(2, -10 * value))

export const scrollWithLenis = (
  target: ScrollTarget,
  options: ScrollWithLenisOptions = {}
) => {
  if (typeof window === "undefined") return

  const { duration = 1.2, immediate = false, offset = 0, onComplete } = options

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
