"use client"

import type { FilterChip, ShopSort } from "../../types"
import styles from "./style.module.scss"

type ShopToolbarProps = {
  chips: FilterChip[]
  count: number
  search: string
  sort: ShopSort
  onOpenFilters: () => void
  onSearch: (value: string) => void
  onSort: (value: ShopSort) => void
}

export default function ShopToolbar({ chips, count, search, sort, onOpenFilters, onSearch, onSort }: ShopToolbarProps) {
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

        <button type="button" className={styles.filterButton} onClick={onOpenFilters}>
          Filtry{chips.length ? <b>{chips.length}</b> : null}
        </button>

        <label className={styles.sort}>
          <span>Řazení</span>
          <select aria-label="Seřadit produkty" value={sort} onChange={(event) => onSort(event.target.value as ShopSort)}>
            <option value="featured">Doporučené</option>
            <option value="newest">Nejnovější</option>
            <option value="price-asc">Cena od nejnižší</option>
            <option value="price-desc">Cena od nejvyšší</option>
          </select>
        </label>
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
