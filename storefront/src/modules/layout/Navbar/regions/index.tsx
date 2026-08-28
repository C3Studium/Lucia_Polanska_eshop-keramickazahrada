"use client"

import { updateRegion } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ComponentType,
  type CSSProperties,
} from "react"

import { useDismiss } from "@lib/hooks/use-dismiss"
import ReactCountryFlag from "react-country-flag"

type CountryOption = {
  country: string
  region: string
  label: string
}

const CountryFlag = ReactCountryFlag as unknown as ComponentType<{
  className?: string
  countryCode: string
  style?: CSSProperties
  svg?: boolean
}>

const ease = [0.76, 0, 0.24, 1] as const

const listVariants: Variants = {
  closed: {
    opacity: 0,
    y: -8,
    scale: 0.94,
    clipPath: "inset(0 0 100% 0 round 18px)",
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    clipPath: "inset(0 0 0% 0 round 18px)",
  },
}

export default function RegionsSelect({
  regions,
}: {
  regions: HttpTypes.StoreRegion[] | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, startSwitching] = useTransition()

  /* Stable, so the dismiss listeners bind once per open rather than once per render. */
  const closeList = useCallback(() => setIsOpen(false), [])

  /*
   * Closed on `mouseleave` and on Escape, and Escape only while the focus was still inside it —
   * so on a phone the country list stayed open over the page with nothing able to dismiss it.
   * This closes it on any press outside and on Escape from anywhere, and it replaces the local
   * keydown handler that used to sit on this element.
   */
  const dismissRef = useDismiss<HTMLDivElement>(isOpen, closeList)
  const { countryCode } = useParams<{ countryCode: string }>()
  const pathname = usePathname()

  const options = useMemo(
    () =>
      (regions ?? [])
        .flatMap((region) =>
          (region.countries ?? []).flatMap((country) =>
            country.iso_2
              ? [
                  {
                    country: country.iso_2,
                    region: region.id,
                    label: country.display_name ?? country.iso_2.toUpperCase(),
                  },
                ]
              : []
          )
        )
        .sort((a, b) => a.label.localeCompare(b.label, "cs")),
    [regions]
  )

  if (!options.length) return null

  const current =
    options.find((option) => option.country === countryCode) ?? options[0]
  const currentPath =
    pathname.replace(new RegExp(`^/${countryCode}`), "") || "/"

  const handleChange = (option: CountryOption) => {
    if (option.country === current.country || isSwitching) {
      setIsOpen(false)
      return
    }

    setIsOpen(false)
    /* The switch ends in a server redirect and takes a moment. Fired bare, React had no idea
       anything was in flight, so a second click queued a second switch and the customer got
       no sign the first one had been heard. */
    startSwitching(async () => {
      await updateRegion(option.country, currentPath)
    })
  }

  return (
    <div
      ref={dismissRef}
      className="regions__select"
      aria-busy={isSwitching || undefined}
      data-switching={isSwitching || undefined}
      data-open={isOpen || undefined}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <motion.button
        type="button"
        className="regions__select__button"
        aria-label={`Země obchodu: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        initial={false}
        animate={isOpen ? "open" : "closed"}
        whileTap={whileTap}
      >
        <motion.span
          className="countryButton__surface"
          variants={variants}
          transition={transition}
          aria-hidden="true"
        />
        <span className="countryButton__flag" aria-hidden="true">
          <CountryFlag
            svg
            style={styleObj}
            countryCode={current.country}
          />
        </span>
        <motion.span
          className="regionArrow"
          variants={variants2}
          transition={transition2}
          aria-hidden="true"
        >
          ↗
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="countryOptions"
            role="listbox"
            aria-label="Vyberte zemi obchodu"
            variants={listVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={transition}
          >
            <div className="countryOptions__label" role="presentation">
              <span>Země obchodu</span>
              <span>{String(options.length).padStart(2, "0")}</span>
            </div>
            {options.map((option, index) => {
              const selected = option.country === current.country

              return (
                <motion.button
                  type="button"
                  key={`${option.region}-${option.country}`}
                  className="countryOption"
                  role="option"
                  aria-selected={selected}
                  data-selected={selected}
                  onClick={() => handleChange(option)}
                  initial={initial}
                  animate={animate}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.035,
                    ease,
                  }}
                  whileHover={whileHover}
                  whileFocus={whileHover}
                  whileTap={whileTap2}
                  title={option.label}
                >
                  <CountryFlag
                    svg
                    className="countryOption__flag"
                    style={styleObj2}
                    countryCode={option.country}
                  />
                  <span>{option.label}</span>
                  <i aria-hidden="true" />
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const whileTap = { scale: 0.96 }
const variants = {
            closed: { scale: 0.55, opacity: 0 },
            open: { scale: 1, opacity: 1 },
          }
const transition = { duration: 0.46, ease }
const styleObj = { width: "22px" as const, height: "22px" as const }
const variants2 = {
            closed: { rotate: 180, x: 0 },
            open: { rotate: 90, x: 1 },
          }
const transition2 = { duration: 0.5, ease }
const initial = { opacity: 0, y: -5 }
const animate = { opacity: 1, y: 0 }
const whileHover = { x: 3 }
const whileTap2 = { scale: 0.98 }
const styleObj2 = { width: "20px" as const, height: "20px" as const }
