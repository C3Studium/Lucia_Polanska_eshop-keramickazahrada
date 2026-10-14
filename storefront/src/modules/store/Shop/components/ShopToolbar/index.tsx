"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { FilterChip, ShopSort } from "../../types"
import styles from "./style.module.scss"

/**
 * Co znamená „Doporučené" (§ 5 ZOS — u řazení musí být řečeno, podle čeho).
 *
 * Musí to být PRAVDA o tom, co kód dělá, ne marketing:
 * - „Doporučené" (`featured`) neposílá Meduse žádné `order`. Medusa 2.18 pak
 *   řadí podle id výrobku vzestupně (`applyDefaultOrdering` v interní službě
 *   modulu: primární klíč ASC) a id je ULID, tedy čas založení — výrobky jdou
 *   za sebou tak, jak přibývaly do e-shopu, nejstarší první. Fulltext (`q`)
 *   jen filtruje, pořadí nemění.
 * - Lokální skládání v `listStoreCatalogue` (`lib/data/products.ts`) k tomu
 *   přidá: při hledání nejdřív přímé shody textu, za nimi výrobky
 *   z odpovídajících kategorií a kolekcí; v kolekci nejdřív výrobky přímo
 *   z kolekce, za nimi výrobky z jejích kategorií.
 * Kdo pořadí změní (třeba ručním řazením), musí změnit i tenhle text.
 */
const FEATURED_EXPLANATION =
  "Doporučené je výchozí pořadí katalogu: výrobky jdou za sebou tak, jak přibývaly do e-shopu, od nejstarších. Při hledání jsou první výrobky, které hledané slovo mají přímo v textu, za nimi výrobky z kategorií a kolekcí, jejichž název odpovídá. V kolekci jsou první výrobky přímo z ní, za nimi výrobky z jejích kategorií. Pořadí neovlivňuje žádná platba ani provize."

function SortExplanation({ panelId }: { panelId: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  /* Žádné `span`y: pravidla `.sort span` v stylech (popisek „Řazení", pod md
     skrytý) by je schovala. */
  return (
    <div className={styles.sortInfo} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.sortInfoButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Podle čeho řadíme Doporučené"
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {/* V DOM pořád (jen `hidden`), aby na něj mohl ukazovat aria-describedby
          selectu — odečítač přečte vysvětlení i bez otevření. */}
      <div
        id={panelId}
        role="note"
        className={styles.sortInfoPanel}
        hidden={!open}
      >
        {FEATURED_EXPLANATION}
      </div>
    </div>
  )
}

type ShopToolbarProps = {
  chips: FilterChip[]
  count: number
  search: string
  sort: ShopSort
  filtersOpen?: boolean
  /** Text tlačítka panelu — mini obchod úpravy nabízí jen kategorie, ne filtry. */
  filterLabel?: string
  onOpenFilters: () => void
  onSearch: (value: string) => void
  onSort: (value: ShopSort) => void
}

export default function ShopToolbar({ chips, count, search, sort, filtersOpen = false, filterLabel = "Filtry", onOpenFilters, onSearch, onSort }: ShopToolbarProps) {
  const sortHintId = useId()

  return (
    <header className={styles.root}>
      <div className={styles.topline}>
        <div className={styles.title}>
          <span>Zobrazujeme</span>
          <p aria-live="polite"><strong>{count}</strong> {count === 1 ? "výrobek" : count > 1 && count < 5 ? "výrobky" : "výrobků"}</p>
        </div>

        <label className={styles.search}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.75" stroke="currentColor" strokeWidth="1.5" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Hledat produkty</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Hledat podle názvu"
            type="search"
            autoComplete="off"
          />
        </label>

        <button
          type="button"
          className={styles.filterButton}
          onClick={onOpenFilters}
          aria-expanded={filtersOpen}
        >
          {filterLabel}{chips.length ? <b>{chips.length}</b> : null}
        </button>

        {/* Obal je `div`, ne `label`: tlačítko s vysvětlením uvnitř `label`
            by bylo neplatné HTML (dva ovládací prvky v jednom popisku). */}
        <div className={styles.sort}>
          <label className={styles.sortLabel}>
            <span>Řazení</span>
            <select
              aria-label="Seřadit produkty"
              aria-describedby={sortHintId}
              value={sort}
              onChange={(event) => onSort(event.target.value as ShopSort)}
            >
              <option value="featured">Doporučené</option>
              <option value="newest">Nejnovější</option>
              <option value="price-asc">Cena od nejnižší</option>
              <option value="price-desc">Cena od nejvyšší</option>
            </select>
          </label>
          <SortExplanation panelId={sortHintId} />
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.chips} aria-label="Aktivní filtry">
          {chips.map((chip) => (
            <button key={chip.id} type="button" onClick={chip.onRemove}>
              {chip.label}<span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
