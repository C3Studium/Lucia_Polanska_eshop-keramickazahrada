"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
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

/* Cena jako rozsah: slider i dvojice inputů píší do téhož `min`/`max` stavu,
   takže se hýbou spolu. Do filtrů odchází string, který umí žít v URL:
   "min-max", "min+" (bez horní meze), "" (bez filtru). */
const PRICE_CEIL = 5000
const PRICE_STEP = 50

const parsePriceValue = (value: string): { min: number; max: number | null } => {
  const open = value.match(/^(\d+)\+$/)
  if (open) return { min: Number(open[1]), max: null }
  const pair = value.match(/^(\d+)-(\d+)$/)
  if (pair) return { min: Number(pair[1]), max: Number(pair[2]) }
  return { min: 0, max: null }
}

const formatPriceValue = (min: number, max: number | null): string => {
  if (min <= 0 && max === null) return ""
  if (max === null) return `${min}+`
  return `${min}-${max}`
}

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
                      {/* Dva proužky: svislý se otočí do vodorovného a + se
                          stočí do −, stejným easingem jako vyjíždění níže. */}
                      <span
                        className={`${styles.plusIcon} ${isExpanded ? styles.plusIconOpen : ""}`}
                        aria-hidden
                      >
                        <i />
                        <i />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && collection.categories.length > 0 && (
                        <motion.div
                          key="sub"
                          className={styles.subList}
                          initial={subClosed}
                          animate={subOpen}
                          exit={subClosed}
                          transition={subTransition}
                        >
                          <div className={styles.subListInner}>
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
                        </motion.div>
                      )}
                    </AnimatePresence>
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
          <PriceFilter
            value={filters.priceRange}
            onChange={(priceRange) => onChange({ priceRange })}
          />
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

/**
 * Od–do cena: dvojitý slider a pod ním číselné inputy, obě cesty píší do
 * téhož stavu, takže se aktualizují spolu. Horní palec na stropě znamená
 * „bez horní meze" (input Do je pak prázdný); commit do filtrů jede
 * s krátkým odstupem, aby tažení palce nespouštělo dotaz na každý pixel.
 */
function PriceFilter({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const parsed = parsePriceValue(value)
  const [min, setMin] = useState(parsed.min)
  const [max, setMax] = useState<number | null>(parsed.max)

  /* Vnější změna (reset filtrů, příchod z URL) přepíše lokální stav. */
  useEffect(() => {
    setMin(parsed.min)
    setMax(parsed.max)
  }, [parsed.min, parsed.max])

  /* Debounced commit — a jen když se string opravdu liší, jinak by sync
     shora a commit zdola kroužily dokola. Pořadí od ≤ do se narovnává až
     tady: clamp přímo v inputu by bránil psát číslo po číslicích. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = formatPriceValue(min, max !== null ? Math.max(max, min) : null)
      if (next !== value) onChange(next)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [min, max, value, onChange])

  const sliderMax = max === null ? PRICE_CEIL : Math.min(max, PRICE_CEIL)
  const minPct = (Math.min(min, PRICE_CEIL) / PRICE_CEIL) * 100
  const maxPct = (sliderMax / PRICE_CEIL) * 100

  return (
    <div className={styles.priceFilter}>
      <div className={styles.priceSlider}>
        <div className={styles.priceSliderTrack} />
        <div
          className={styles.priceSliderFill}
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={PRICE_CEIL}
          step={PRICE_STEP}
          value={Math.min(min, PRICE_CEIL)}
          aria-label="Cena od"
          onChange={(e) => setMin(Math.min(Number(e.target.value), sliderMax))}
        />
        <input
          type="range"
          min={0}
          max={PRICE_CEIL}
          step={PRICE_STEP}
          value={sliderMax}
          aria-label="Cena do"
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), min)
            setMax(next >= PRICE_CEIL ? null : next)
          }}
        />
      </div>
      <div className={styles.priceInputs}>
        <label>
          <span>Od</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={min > 0 ? min : ""}
            placeholder="0"
            onChange={(e) => setMin(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <i aria-hidden>–</i>
        <label>
          <span>Do</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={max ?? ""}
            placeholder="bez limitu"
            onChange={(e) => {
              const raw = e.target.value.trim()
              setMax(raw ? Math.max(0, Number(raw) || 0) : null)
            }}
          />
        </label>
        <span className={styles.priceUnit}>Kč</span>
      </div>
    </div>
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

/* FAQ-style rozbalení subkategorií: výška 0 ↔ auto, stejná křivka jako
   zbytek obchodu. */
const subClosed = { height: 0, opacity: 0 }
const subOpen = { height: "auto", opacity: 1 }
const subTransition = { duration: 0.45, ease: [0.76, 0, 0.24, 1] as const }
