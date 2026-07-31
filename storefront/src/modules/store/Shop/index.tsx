"use client"

import { listStoreCatalogue } from "@lib/data/products"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import type { HttpTypes } from "@medusajs/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import FilterPanel from "./components/FilterPanel"
import ProductGrid from "./components/ProductGrid"
import ShopHero from "./components/ShopHero"
import ShopToolbar from "./components/ShopToolbar"
import type { FilterChip, ShopCategory, ShopFilters } from "./types"
import styles from "./style.module.scss"

type EComProps = {
  countryCode: string
  products: HttpTypes.StoreProduct[]
  categories?: ShopCategory[]
  totalCount?: number
  initialFilters?: Partial<ShopFilters>
  initialFilterLabel?: string
}

const PRODUCT_LIMIT = 16
const emptyFilters: ShopFilters = {
  categoryId: "",
  collectionId: "",
  isNew: false,
  onSale: false,
  priceRange: "",
  search: "",
  sort: "featured",
}

const priceLabels: Record<string, string> = {
  "0-500": "Do 500 Kč",
  "500-1000": "500–1 000 Kč",
  "1000-2500": "1 000–2 500 Kč",
  "2500+": "Nad 2 500 Kč",
}

export default function ECom({
  countryCode,
  products: initialProducts,
  categories = [],
  totalCount,
  initialFilters,
  initialFilterLabel,
}: EComProps) {
  const [products, setProducts] = useState(initialProducts)
  const [filters, setFilters] = useState<ShopFilters>(() => ({
    ...emptyFilters,
    ...initialFilters,
  }))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [requestVersion, setRequestVersion] = useState(0)
  const [resultCount, setResultCount] = useState(
    totalCount ?? initialProducts.length
  )
  const [allLoaded, setAllLoaded] = useState(
    initialProducts.length >= (totalCount ?? initialProducts.length)
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const catalogueRef = useRef<HTMLDivElement>(null)
  const initialQuery = useRef(true)
  const requestSequence = useRef(0)
  const filterTrigger = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setProducts(initialProducts)
    setResultCount(totalCount ?? initialProducts.length)
    setAllLoaded(
      initialProducts.length >= (totalCount ?? initialProducts.length)
    )
  }, [initialProducts, totalCount])

  const updateFilters = useCallback((patch: Partial<ShopFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  const resetFilters = useCallback(() => setFilters(emptyFilters), [])
  const openFilters = useCallback(() => {
    filterTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setFiltersOpen(true)
  }, [])
  const closeFilters = useCallback(() => {
    setFiltersOpen(false)
    window.requestAnimationFrame(() => filterTrigger.current?.focus())
  }, [])

  useEffect(() => {
    if (!filtersOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFilters()
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeFilters, filtersOpen])

  useEffect(() => {
    if (initialQuery.current) {
      initialQuery.current = false
      return
    }

    const requestId = ++requestSequence.current
    const delay = filters.search.trim() ? 320 : 0

    setRefreshing(true)
    setLoadError(false)

    const timer = window.setTimeout(async () => {
      try {
        const payload = await listStoreCatalogue({
          filters,
          limit: PRODUCT_LIMIT,
          offset: 0,
          countryCode,
        })
        if (requestId !== requestSequence.current) return

        setProducts(payload.products)
        setResultCount(payload.count)
        setAllLoaded(payload.products.length >= payload.count)
      } catch (error) {
        if (requestId !== requestSequence.current) return
        console.error("Store catalogue query failed", error)
        setLoadError(true)
      } finally {
        if (requestId === requestSequence.current) setRefreshing(false)
      }
    }, delay)

    return () => {
      window.clearTimeout(timer)
      requestSequence.current += 1
    }
  }, [countryCode, filters, requestVersion])

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    const category = categories.find((item) => item.id === filters.categoryId)
    if (category)
      chips.push({
        id: "category",
        label: category.name,
        onRemove: () => updateFilters({ categoryId: "" }),
      })
    if (filters.collectionId)
      chips.push({
        id: "collection",
        label: initialFilterLabel ?? "Kolekce",
        onRemove: () => updateFilters({ collectionId: "" }),
      })
    if (filters.priceRange)
      chips.push({
        id: "price",
        label: priceLabels[filters.priceRange],
        onRemove: () => updateFilters({ priceRange: "" }),
      })
    if (filters.isNew)
      chips.push({
        id: "new",
        label: "Novinky",
        onRemove: () => updateFilters({ isNew: false }),
      })
    if (filters.onSale)
      chips.push({
        id: "sale",
        label: "Ve slevě",
        onRemove: () => updateFilters({ onSale: false }),
      })
    return chips
  }, [
    categories,
    filters.categoryId,
    filters.collectionId,
    filters.isNew,
    filters.onSale,
    filters.priceRange,
    initialFilterLabel,
    updateFilters,
  ])

  const loadMore = useCallback(async () => {
    if (loading || allLoaded) return
    const requestId = ++requestSequence.current
    setLoading(true)
    setLoadError(false)

    try {
      const payload = await listStoreCatalogue({
        filters,
        limit: PRODUCT_LIMIT,
        offset: products.length,
        countryCode,
      })
      if (requestId !== requestSequence.current) return

      const knownIds = new Set(products.map((product) => product.id))
      const additions = payload.products.filter(
        (product) => !knownIds.has(product.id)
      )
      setProducts((current) => {
        return [...current, ...additions]
      })
      setResultCount(payload.count)
      setAllLoaded(products.length + additions.length >= payload.count)
    } catch (error) {
      if (requestId !== requestSequence.current) return
      console.error("Store catalogue pagination failed", error)
      setLoadError(true)
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [allLoaded, countryCode, filters, loading, products])

  const scrollToCatalogue = () => {
    if (catalogueRef.current) scrollWithLenis(catalogueRef.current)
  }

  return (
    <main className={styles.root}>
      <ShopHero
        productCount={totalCount || products.length}
        onExplore={scrollToCatalogue}
      />

      <section
        ref={catalogueRef}
        className={styles.catalogue}
        id="store-catalogue"
        data-scroll-section
        data-scroll-label="Katalog"
        aria-label="Katalog produktů"
      >
        <header className={styles.introduction}>
          <p>Ateliérový výběr</p>
          <h2>
            Vyberte si objekt,
            <br />
            <em>který zůstane.</em>
          </h2>
          <span>
            Užitá keramika, autorské solitéry a drobné série. Přirozené odchylky
            nejsou vadou, ale podpisem rukou.
          </span>
        </header>

        <div className={styles.layout}>
          <FilterPanel
            categories={categories}
            filters={filters}
            isOpen={filtersOpen}
            onChange={updateFilters}
            onClose={closeFilters}
            onReset={resetFilters}
          />

          <div className={styles.results}>
            <ShopToolbar
              chips={activeChips}
              count={resultCount}
              search={filters.search}
              sort={filters.sort}
              onOpenFilters={openFilters}
              onSearch={(search) => updateFilters({ search })}
              onSort={(sort) => updateFilters({ sort })}
            />
            <ProductGrid
              products={products}
              loading={loading}
              refreshing={refreshing}
              loadError={loadError}
              canLoadMore={!allLoaded}
              total={resultCount}
              loadedCount={products.length}
              onLoadMore={loadMore}
              onRetry={() => setRequestVersion((current) => current + 1)}
              onReset={resetFilters}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
