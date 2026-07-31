"use client"

import { updateRegion } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
import {
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react"
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
    if (option.country === current.country) {
      setIsOpen(false)
      return
    }

    setIsOpen(false)
    void updateRegion(option.country, currentPath)
  }

  return (
    <div
      className="regions__select"
      data-open={isOpen || undefined}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false)
      }}
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
        whileTap={{ scale: 0.96 }}
      >
        <motion.span
          className="countryButton__surface"
          variants={{
            closed: { scale: 0.55, opacity: 0 },
            open: { scale: 1, opacity: 1 },
          }}
          transition={{ duration: 0.46, ease }}
          aria-hidden="true"
        />
        <span className="countryButton__flag">
          <CountryFlag
            svg
            style={{ width: "22px", height: "22px" }}
            countryCode={current.country}
          />
        </span>
        <motion.span
          className="regionArrow"
          variants={{
            closed: { rotate: 180, x: 0 },
            open: { rotate: 90, x: 1 },
          }}
          transition={{ duration: 0.5, ease }}
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
            transition={{ duration: 0.46, ease }}
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
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.035,
                    ease,
                  }}
                  whileHover={{ x: 3 }}
                  whileFocus={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  title={option.label}
                >
                  <CountryFlag
                    svg
                    className="countryOption__flag"
                    style={{ width: "20px", height: "20px" }}
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
