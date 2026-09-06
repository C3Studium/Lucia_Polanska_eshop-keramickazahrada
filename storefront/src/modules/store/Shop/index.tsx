"use client"

import { listStoreCatalogue } from "@lib/data/products"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import type { HttpTypes } from "@medusajs/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  clearShopSnapshot,
  peekShopSnapshot,
  saveShopSnapshot,
} from "./restore"
import FilterPanel from "./components/FilterPanel"
import ProductGrid from "./components/ProductGrid"
// import ShopHero from "./components/ShopHero"
import ShopToolbar from "./components/ShopToolbar"
import type { FilterChip, ShopCategory, ShopFilters, ShopNavCollection } from "./types"
import styles from "./style.module.scss"

type EComProps = {
  countryCode: string
  products: HttpTypes.StoreProduct[]
  categories?: ShopCategory[]
  navCollections?: ShopNavCollection[]
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
  navCollections = [],
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
  /**
   * Běží obnova stavu? Dokud ano, sdílený dotaz mlčí — výpis si načítá ona.
   *
   * Ne „přeskoč příští dotaz": React ve vývoji efekty spouští dvakrát, takže
   * jednorázové přeskočení se vyčerpalo na běhu, který o obnovu vůbec nešlo.
   * A ne porovnání filtrů: sdílený dotaz se v tom dvojím kole dostane ke slovu
   * dřív, než se obnovené filtry projeví ve stavu, takže by vlastní obnovu
   * považoval za cizí zásah. Obojí končilo výpisem sraženým na prvních
   * šestnáct kusů.
   */
  const restoreInFlight = useRef(false)
  /** Sáhl člověk na filtr dřív, než se obnova vrátila? Pak má přednost on. */
  const restoreCancelled = useRef(false)
  /** Obnova už běží — druhé spuštění efektu ji nemá rozjíždět znovu. */
  const restoreStarted = useRef(false)
  /** Obnovený výpis už na stránce je — serverový ho nemá čím nahradit. */
  const restored = useRef(false)

  useEffect(() => {
    /*
     * Po obnovené návštěvě ne. Při kroku zpět router vykreslí stránku znovu
     * a `initialProducts` přijdou jako nové pole — tenhle efekt se proto
     * spustí ZNOVU, už po obnově, a přepsal jí načtený výpis zpátky na první
     * stránku: naměřeno 16 kusů místo 48, které se stihly načíst a vykreslit.
     * Serverový výpis je v tu chvíli stejně mimo — patří k filtrům z adresy,
     * ne k těm, které si člověk nastavil a které obnova právě vrátila.
     */
    if (restored.current) return

    setProducts(initialProducts)
    setResultCount(totalCount ?? initialProducts.length)
    setAllLoaded(
      initialProducts.length >= (totalCount ?? initialProducts.length)
    )
  }, [initialProducts, totalCount])

  /*
   * ─── Návrat z výrobku ───────────────────────────────────────────────────
   *
   * Snímek se ukládá při kliknutí na kartu výrobku (posluchač níž) a tady se
   * spotřebuje. Načte se v JEDNOM dotazu tolik kusů, kolik jich bylo předtím
   * — čtyři kliknutí na „Načíst další" tedy neznamenají čtyři dotazy —,
   * a teprve až jsou vykreslené, vrátí se scroll. Dřív by neměl kam: stránka
   * je v tu chvíli vysoká šestnáct kusů a scroll by se ořízl na její konec.
   *
   * `restoreFilters` říká sdílenému dotazu, že tenhle filtr si obsluhuje
   * obnova — jinak by načetl první stránku a tenhle výsledek přebil.
   * `restoreCancelled` hlídá opačný směr: sáhne-li člověk na filtr dřív, než
   * se obnova vrátí, má přednost on a výsledek obnovy se zahodí.
   *
   * Bez rušení při odpojení: React ve vývoji efekt spustí, uklidí a spustí
   * znovu, takže úklid rušící rozdělaný dotaz by obnovu zabil pokaždé. Hlídá
   * to `restoreStarted` — rozjede se jednou za život komponenty.
   */
  useEffect(() => {
    if (restoreStarted.current) return

    const snapshot = peekShopSnapshot()
    if (!snapshot) return

    restoreStarted.current = true
    restoreInFlight.current = true
    setFilters(snapshot.filters)
    setRefreshing(true)
    setLoadError(false)

    ;(async () => {
      try {
        const payload = await listStoreCatalogue({
          filters: snapshot.filters,
          limit: Math.max(snapshot.loaded, PRODUCT_LIMIT),
          offset: 0,
          countryCode,
        })
        if (restoreCancelled.current) return

        restored.current = true
        setProducts(payload.products)
        setResultCount(payload.count)
        setAllLoaded(payload.products.length >= payload.count)

        window.requestAnimationFrame(() =>
          scrollWithLenis(snapshot.scrollY, { immediate: true })
        )
      } catch (error) {
        if (restoreCancelled.current) return
        console.error("Obnova stavu obchodu selhala", error)
        setLoadError(true)
      } finally {
        /* Snímek platí pro jeden návrat — a padá i když se dotaz nepovedl,
           ať se stará poloha nevrací při příští návštěvě obchodu. */
        clearShopSnapshot()
        restoreInFlight.current = false
        setRefreshing(false)
      }
    })()
    // Jen při příchodu na stránku; `countryCode` se za života komponenty nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * Snímek se pořizuje v okamžiku odchodu, ne průběžně: posluchač v zachytávací
   * fázi na obalu katalogu chytí kliknutí na kteroukoli kartu výrobku dřív, než
   * router odejde. Jedno místo pro všechny odkazy v mřížce — karty by jinak
   * musely dostat callback a vědět, že nějaká paměť obchodu existuje.
   */
  useEffect(() => {
    const root = catalogueRef.current
    if (!root) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest?.("a[href*='/products/']")) return

      saveShopSnapshot({
        filters,
        loaded: products.length,
        scrollY: window.scrollY,
      })
    }

    root.addEventListener("click", handleClick, true)
    return () => root.removeEventListener("click", handleClick, true)
  }, [filters, products.length])

  /*
   * Od téhle chvíle platí volba člověka, ne uložený snímek. Sedí to na
   * `updateFilters`/`resetFilters`, protože tudy vede KAŽDÝ zásah do filtrů —
   * panel, štítky i řazení a hledání v liště. Doběhne-li obnova až po nich,
   * výsledek se zahodí místo aby jejich volbu přepsal.
   */
  const cancelRestore = useCallback(() => {
    restoreInFlight.current = false
    restoreCancelled.current = true
  }, [])

  const updateFilters = useCallback(
    (patch: Partial<ShopFilters>) => {
      cancelRestore()
      setFilters((current) => ({ ...current, ...patch }))
    },
    [cancelRestore]
  )

  const resetFilters = useCallback(() => {
    cancelRestore()
    setFilters(emptyFilters)
  }, [cancelRestore])
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

    /* Dokud běží obnova stavu, výpis si obsluhuje ona — a rovnou celý, ne jen
       první stránku. Zruší ji až skutečný zásah člověka (`cancelRestore`
       v `updateFilters`/`resetFilters`), ne tenhle efekt: ten se ve vývoji
       spustí dřív, než se obnovené filtry stihnou projevit ve stavu, a
       porovnávat hodnoty tu tedy znamená považovat vlastní obnovu za cizí
       zásah — naměřeno jako druhý dotaz, který výpis srazil na 16 kusů. */
    if (restoreInFlight.current) return

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

  /* Hero je schovaný — katalog teď stránku otevírá. Až se vrátí, vrátí se i tohle scrollování.
  const scrollToCatalogue = () => {
    if (catalogueRef.current) scrollWithLenis(catalogueRef.current)
  }
  */

  // Co přesně filtr právě vymezuje — jméno kategorie/kolekce pod titulkem sekce.
  const activeCategoryName = categories.find(
    (item) => item.id === filters.categoryId
  )?.name
  const activeCollectionTitle =
    navCollections.find((item) => item.id === filters.collectionId)?.title ??
    (filters.collectionId ? initialFilterLabel : undefined)
  const filterScope =
    [activeCollectionTitle, activeCategoryName].filter(Boolean).join(" · ") ||
    "Vše"

  return (
    <main className={styles.root}>
      {/* <ShopHero
        productCount={totalCount || products.length}
        onExplore={scrollToCatalogue}
      /> */}

      <section
        ref={catalogueRef}
        className={styles.catalogue}
        id="store-catalogue"
        data-scroll-section
        data-scroll-label="Katalog"
        aria-label="Katalog produktů"
      >
        <header className={styles.introduction}>
          <p>
            Co je právě k mání
            <span className={styles.filterScope}>{filterScope}</span>
          </p>
          <h2>
            Vyberte si něco,
            <br />
            <em>co vám zůstane.</em>
          </h2>
          <span>
            Keramika na běžné používání, jednotlivé kusy i malé série. Drobné
            odchylky nejsou vada — podle nich poznáte, že to dělal člověk.
          </span>
        </header>

        <div className={styles.layout}>
          <FilterPanel
        navCollections={navCollections}
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
              filtersOpen={filtersOpen}
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
