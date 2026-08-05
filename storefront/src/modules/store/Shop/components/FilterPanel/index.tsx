"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef } from "react"
import type { ShopCategory, ShopFilters } from "../../types"
import styles from "./style.module.scss"

type FilterPanelProps = {
  categories: ShopCategory[]
  filters: ShopFilters
  isOpen: boolean
  onChange: (patch: Partial<ShopFilters>) => void
  onClose: () => void
  onReset: () => void
}

const priceRanges = [
  { value: "", label: "Všechny ceny" },
  { value: "0-500", label: "Do 500 Kč" },
  { value: "500-1000", label: "500–1 000 Kč" },
  { value: "1000-2500", label: "1 000–2 500 Kč" },
  { value: "2500+", label: "Nad 2 500 Kč" },
]

export default function FilterPanel({
  categories,
  filters,
  isOpen,
  onChange,
  onClose,
  onReset,
}: FilterPanelProps) {
  const activeCount = [filters.categoryId, filters.priceRange, filters.isNew, filters.onSale].filter(Boolean).length
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => closeRef.current?.focus(), 120)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            className={styles.mobileBackdrop}
            aria-label="Zavřít filtry"
            onClick={onClose}
            initial={initial}
            animate={animate}
            exit={initial}
          />
        )}
      </AnimatePresence>
      <motion.aside
        className={`${styles.root} ${isOpen ? styles.open : ""}`}
        initial={false}
        aria-label="Filtrování produktů"
        aria-modal={isOpen || undefined}
        role={isOpen ? "dialog" : undefined}
      >
        <div className={styles.heading}>
          <div>
            <span>Studio výběru</span>
            <h2>Najděte svůj kus</h2>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Zavřít filtry">×</button>
        </div>

        <FilterGroup index="01" title="Kategorie">
          <div className={styles.categoryList}>
            <FilterButton active={!filters.categoryId} label="Všechny objekty" onClick={() => onChange({ categoryId: "" })} />
            {categories.map((category) => (
              <FilterButton
                key={category.id}
                active={filters.categoryId === category.id}
                label={category.name}
                onClick={() => onChange({ categoryId: filters.categoryId === category.id ? "" : category.id })}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup index="02" title="Cena">
          <div className={styles.priceGrid}>
            {priceRanges.map((range) => (
              <button
                type="button"
                key={range.value || "all"}
                className={filters.priceRange === range.value ? styles.selectedPill : ""}
                aria-pressed={filters.priceRange === range.value}
                onClick={() => onChange({ priceRange: range.value })}
              >
                {range.label}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup index="03" title="Výběr">
          <Toggle label="Novinky" active={filters.isNew} onClick={() => onChange({ isNew: !filters.isNew })} />
          <Toggle label="Ve slevě" active={filters.onSale} onClick={() => onChange({ onSale: !filters.onSale })} />
        </FilterGroup>

        <div className={styles.footer}>
          <span>{activeCount ? `${activeCount} aktivní` : "Bez omezení"}</span>
          <button type="button" onClick={onReset} disabled={!activeCount}>Vyčistit výběr</button>
        </div>
      </motion.aside>
    </>
  )
}

function FilterGroup({ children, index, title }: { children: React.ReactNode; index: string; title: string }) {
  return (
    <section className={styles.group}>
      <header><small>{index}</small><h3>{title}</h3></header>
      {children}
    </section>
  )
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={active ? styles.activeCategory : ""} aria-pressed={active} onClick={onClick}>
      <span>{label}</span><i />
    </button>
  )
}

function Toggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.toggle} aria-pressed={active} onClick={onClick}>
      {label}<span><i /></span>
    </button>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0 }
const animate = { opacity: 1 }
