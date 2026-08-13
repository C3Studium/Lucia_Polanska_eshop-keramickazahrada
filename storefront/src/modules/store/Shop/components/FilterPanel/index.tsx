"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef } from "react"
import type { ShopCategory, ShopFilters } from "../../types"
import styles from "./style.module.scss"

type FilterPanelProps = {
  categories: ShopCategory[]
  navCollections?: import("../../types").ShopNavCollection[]
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
  navCollections = [],
  filters,
  isOpen,
  onChange,
  onClose,
  onReset,
}: FilterPanelProps) {
  const activeCount = [
    filters.categoryId || filters.collectionId,
    filters.priceRange,
    filters.isNew,
    filters.onSale,
  ].filter(Boolean).length
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
            <span>Filtry</span>
            <h2>Najděte, co hledáte</h2>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Zavřít filtry">×</button>
        </div>

        {/* Jedna hierarchie místo dvou seznamů (Matěj, 2026-08-13): zákazník
            zná „kategorie" z menu Eshop produktů, kde jsou nahoře kolekce.
            Klik na kolekci ji vybere a rozbalí subkategorie; rozbalení řídí
            přímo vybraná kolekce, žádný druhý stav. Plochý seznam kategorií
            zůstává jen jako záloha pro obchod bez kolekcí. */}
        {navCollections.length > 0 ? (
          <FilterGroup index="00" title="Kategorie">
            <div className={styles.categoryList}>
              <FilterButton
                active={!filters.categoryId && !filters.collectionId}
                label="Všechno"
                onClick={() => onChange({ collectionId: "", categoryId: "" })}
              />
              {navCollections.map((collection) => {
                const isExpanded = filters.collectionId === collection.id
                const isActive = isExpanded && !filters.categoryId
                return (
                  <div key={collection.id}>
                    <button
                      type="button"
                      className={`${styles.collectionRow} ${isActive ? styles.activeCategory : ""}`}
                      aria-pressed={isActive}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        onChange(
                          isActive
                            ? { collectionId: "", categoryId: "" }
                            : { collectionId: collection.id, categoryId: "" }
                        )
                      }
                    >
                      <span>{collection.title}</span>
                      <em aria-hidden>{isExpanded ? "–" : "+"}</em>
                    </button>
                    {isExpanded && collection.categories.length > 0 && (
                      <div className={styles.subList}>
                        {collection.categories.map((category) => (
                          <FilterButton
                            key={category.id}
                            active={filters.categoryId === category.id}
                            label={category.name}
                            onClick={() =>
                              onChange(
                                filters.categoryId === category.id
                                  ? { categoryId: "" }
                                  : {
                                      collectionId: collection.id,
                                      categoryId: category.id,
                                    }
                              )
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </FilterGroup>
        ) : (
          <FilterGroup index="00" title="Kategorie">
            <div className={styles.categoryList}>
              <FilterButton active={!filters.categoryId} label="Všechno" onClick={() => onChange({ categoryId: "" })} />
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
        )}

        <FilterGroup index="01" title="Cena">
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

        <FilterGroup index="02" title="Výběr">
          <Toggle label="Novinky" active={filters.isNew} onClick={() => onChange({ isNew: !filters.isNew })} />
          <Toggle label="Ve slevě" active={filters.onSale} onClick={() => onChange({ onSale: !filters.onSale })} />
        </FilterGroup>

        <div className={styles.footer}>
          <span>{activeCount ? `${activeCount} aktivní` : "Zatím bez filtrů"}</span>
          <button type="button" onClick={onReset} disabled={!activeCount}>Zrušit filtry</button>
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
