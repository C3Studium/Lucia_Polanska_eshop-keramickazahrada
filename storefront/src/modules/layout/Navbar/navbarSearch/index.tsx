"use client"

import { surfaceRoot, useStudioSurface } from "@c3studium/valecms/edit"
import { listStoreCatalogue } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDragScroll } from "./useDragScroll"
import { RailScrollbar } from "./RailScrollbar"
import ProductCard from "@modules/store/Shop/components/ProductCard"
import {
  PriceFilter,
  Toggle,
  priceScaleFor,
} from "@modules/store/Shop/components/FilterPanel"
import { parsePriceRange } from "@lib/util/catalogue-filter"
import { useParams } from "next/navigation"
import { normalizeSearch, rankBySearch } from "@lib/util/search-rank"
import { useScrollLock } from "@lib/hooks/use-scroll-lock"
import styles from "./style.module.scss"
import { alpha, palette } from "styles/palette.generated"
import { itemText } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import { useCopyBlock } from "@modules/common/components/cms-text/copy-context"

/**
 * Texty hledání v menu — blok `global.hledani` (poskytuje hlavní layout).
 * Počty výsledků, názvy filtrů (cenová pásma odpovídají filtrům obchodu)
 * a hláška při chybě načítání zůstávají v kódu.
 */
const SEARCH_DEFAULTS = {
  prochazet: "Procházet podle",
  nic: "Nic jsme nenašli",
  prazdne: "Zkuste jiný název, kategorii nebo kolekci.",
  "prazdne.tlacitko": "Zobrazit všechno",
} as const

const ease = [0.22, 1, 0.36, 1] as const
const revealEase = [0.76, 0, 0.24, 1] as const

type SearchCategory =
  | string
  | { id?: string; name?: string; handle?: string | null }

export type NavbarProductHit = {
  objectID?: string
  id?: string
  title?: string
  handle?: string | null
  thumbnail?: string | null
  collection_title?: string | null
  collection_handle?: string | null
  collection?: { title?: string; handle?: string | null } | null
  categories?: SearchCategory[] | null
  category?: SearchCategory | null
}

type NavbarSearchProps = {
  countryCode: string
  isOpen: boolean
  onClose: () => void
  onQueryChange: (query: string) => void
  query: string
}

const CATALOGUE_PAGE_SIZE = 48

const fallbackFilters = {
  categoryId: "",
  collectionId: "",
  isNew: false,
  onSale: false,
  priceRange: "",
  search: "",
  sort: "featured" as const,
}

const contentVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.68,
      staggerChildren: 0.13,
    },
  },
}

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.52, ease },
  },
}

const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.055,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease },
  },
}

/**
 * Výběr a cena — stejná pravidla jako filtry obchodu (lib/util/catalogue-filter):
 * cena = nejnižší z variant, druh kusu podle metadat výrobku.
 */
function matchesFacets(product: any, facets: string[], priceRange: string) {
  const prices = ((product?.variants ?? []) as any[])
    .map((variant) => ({
      amount: Number(variant?.calculated_price?.calculated_amount ?? NaN),
      sale: variant?.calculated_price?.calculated_price?.price_list_type === "sale",
    }))
    .filter((price) => Number.isFinite(price.amount))
  const cheapest = prices.length
    ? prices.reduce((low, price) => (price.amount < low.amount ? price : low))
    : null
  const meta = (product?.metadata ?? {}) as Record<string, unknown>
  const isNew =
    product?.created_at &&
    new Date(product.created_at).getTime() > Date.now() - 30 * 86400000

  const range = parsePriceRange(priceRange)
  if (range && (!cheapest || cheapest.amount < range.min || cheapest.amount > range.max)) {
    return false
  }

  return facets.every((facet) => {
    switch (facet) {
      case "sale":
        return Boolean(cheapest?.sale)
      case "new":
        return Boolean(isNew)
      case "clearance":
        return meta.clearance === true
      case "bundle":
        return meta.is_bundle === true
      case "madeToOrder":
        return meta.made_to_order === true
      default:
        return true
    }
  })
}

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")
    .trim()

const getCategoryNames = (hit: NavbarProductHit) => {
  const categories = hit.categories ?? (hit.category ? [hit.category] : [])

  return categories
    .map((category) =>
      typeof category === "string" ? category : category.name
    )
    .filter((name): name is string => Boolean(name))
}

const getCollectionName = (hit: NavbarProductHit) =>
  hit.collection_title ?? hit.collection?.title ?? null

const getProductSearchValue = (hit: NavbarProductHit) =>
  normalizeSearchValue(
    [hit.title, getCollectionName(hit), ...getCategoryNames(hit)]
      .filter(Boolean)
      .join(" ")
  )

/* One quarry card exists per search hit (up to a full catalogue page), and the panel re-renders
   on every keystroke. These were inline literals: seven fresh objects per card, per keystroke. */
const quarryVariants: Variants = {
  rest: { y: 0, color: palette.ink05 },
  hover: { y: -4, color: palette.ink05 },
}
const quarryTransition = {
  y: { duration: 0.5, ease },
  color: { duration: 0.24, ease },
}
const surfaceVariants: Variants = {
  rest: { scaleX: 0, opacity: 0 },
  hover: { scaleX: 1, opacity: 1 },
}
const surfaceTransition = { duration: 0.62, ease: revealEase }
const surfaceStyle = { originX: 0 }
const thumbVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.035 },
}
const thumbTransition = { duration: 0.72, ease }
const arrowVariants: Variants = {
  rest: {
    x: 0,
    rotate: 0,
    color: palette.ink05,
    backgroundColor: alpha("ink05", 0),
  },
  hover: {
    x: 3,
    rotate: 45,
    color: palette.cream09,
    backgroundColor: palette.ink05,
  },
}
const arrowTransition = { duration: 0.44, ease }

const chipInitial = { opacity: 0, x: -14 }
const chipVariants: Variants = {
  rest: { opacity: 1, x: 0, color: palette.ink05 },
  hover: { opacity: 1, x: 0, color: palette.selectCream },
}
const chipFillVariants: Variants = { hover: { scaleX: 1 } }
const chipFillInitial = { scaleX: 0 }
const chipFillStyle = { originX: 0 }
const chipFillTransition = { duration: 0.5, ease: revealEase }

const fadeOnly = { opacity: 0 }
const fadeIn = { opacity: 1 }
const riseFrom = { opacity: 0, y: 12 }
const riseTo = { opacity: 1, y: 0 }
const backdropTransition = { duration: 0.38, ease }
const panelTransition = { duration: 0.7, ease: revealEase }

function ProductQuarryBase({ hit }: { hit: NavbarProductHit }) {
  const [isActive, setIsActive] = useState(false)

  const { category, collection, href } = useMemo(
    () => ({
      category: getCategoryNames(hit)[0],
      collection: getCollectionName(hit),
      href: hit.handle ? `/products/${hit.handle}` : "/store",
    }),
    [hit]
  )

  const activate = useCallback(() => setIsActive(true), [])
  const deactivate = useCallback(() => setIsActive(false), [])

  return (
    <motion.div
      className={styles.productMotion}
      initial="rest"
      animate={isActive ? "hover" : "rest"}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onFocusCapture={activate}
      onBlurCapture={deactivate}
      variants={quarryVariants}
      transition={quarryTransition}
    >
      <LocalizedClientLink
        href={href}
        className={styles.product}
        data-testid="navbar-search-result"
      >
        <motion.span
          className={styles.productSurface}
          variants={surfaceVariants}
          style={surfaceStyle}
          transition={surfaceTransition}
          aria-hidden="true"
        />
        <div className={styles.thumbnailWrap}>
          <motion.div
            className={styles.thumbnailMotion}
            variants={thumbVariants}
            transition={thumbTransition}
          >
            <Thumbnail
              thumbnail={hit.thumbnail ?? null}
              size="square"
              className={styles.thumbnail}
            />
          </motion.div>
          <span className={styles.productIndex} aria-hidden="true">
            Výrobek
          </span>
        </div>
        <div className={styles.productCopy}>
          <span className={styles.productMeta}>
            {category ?? collection ?? "Keramika"}
          </span>
          <h3>{hit.title ?? "Produkt"}</h3>
          <span className={styles.productFooter}>
            <span>{category && collection ? collection : "Z ateliéru"}</span>
            <motion.i
              variants={arrowVariants}
              transition={arrowTransition}
              aria-hidden="true"
            >
              ↗︎
            </motion.i>
          </span>
        </div>
      </LocalizedClientLink>
    </motion.div>
  )
}

/* Filtering happens upstream; when a hit survives a keystroke its object identity is unchanged,
   so the card can skip re-rendering entirely. */
export const ProductQuarry = memo(ProductQuarryBase)

type SearchContentProps = Pick<
  NavbarSearchProps,
  "onClose" | "onQueryChange" | "query"
> & {
  isLoading: boolean
  loadError: boolean
  products: NavbarProductHit[]
  onRetry: () => void
  entranceComplete: boolean
}

/* Texty výrobku pro hledání — tatáž pravidla jako obchod (lib/util/search-rank). */
const searchFieldsOfHit = (hit: NavbarProductHit) => ({
  title: hit.title,
  taxonomy: [...getCategoryNames(hit), getCollectionName(hit), (hit as any).type?.value],
  description: (hit as any).description as string | null | undefined,
})

/* Stejný „Výběr" jako v obchodě (FilterPanel). Poškozené, Balíčky a Zakázky
   jsou druh kusu — vylučují se navzájem jako `kind` v obchodě. */
const FACETS = [
  { id: "new", label: "Novinky" },
  { id: "sale", label: "Ve slevě" },
  { id: "clearance", label: "Poškozené" },
  { id: "bundle", label: "Balíčky" },
  { id: "madeToOrder", label: "Zakázky" },
] as const
const KIND_FACETS = new Set(["clearance", "bundle", "madeToOrder"])

const facetLabel = (id: string) => FACETS.find((facet) => facet.id === id)?.label ?? id

const priceNumber = new Intl.NumberFormat("cs-CZ")
/** „200–1 500 Kč", „od 500 Kč", „do 800 Kč" — štítek ceny v hlavičce. */
const priceRangeLabel = (value: string, unit: string) => {
  const range = parsePriceRange(value)
  if (!range) return ""
  if (!Number.isFinite(range.max)) return `od ${priceNumber.format(range.min)} ${unit}`
  if (range.min <= 0) return `do ${priceNumber.format(range.max)} ${unit}`
  return `${priceNumber.format(range.min)}–${priceNumber.format(range.max)} ${unit}`
}

/* Mezera mezi sloupci v pásu — totéž číslo jako `column-gap` v .shopTrack;
   mezi řadami je víc (`--rail-row-gap`, nejvýš ~36 px). */
const RAIL_GAP = 14

/** Rohy okna hledání — stejná čísla jako `border-radius` .panel ve stylu. */
const PANEL_RADIUS = 15
const PANEL_RADIUS_NARROW = 11
const RAIL_ROW_GAP = 36

/**
 * Kolik sloupců a řad se vejde do pásu: 4 sloupce na počítači, 3 na úzkém
 * okně, 2 na telefonu; 2 řady, dokud je pás aspoň na dvě karty vysoký.
 */
function useRailGrid(railRef: React.RefObject<HTMLDivElement | null>) {
  const [grid, setGrid] = useState({ cols: 4, rows: 2, width: 0 })

  useEffect(() => {
    const el = railRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      const cols = width >= 820 ? 4 : width >= 520 ? 3 : 2
      /* Nejmenší karta: na telefonu bez druhu a popisu (~170 px), jinak ~210. */
      const minCard = width < 600 ? 168 : 208
      const rows = height >= 2 * minCard + RAIL_ROW_GAP ? 2 : 1
      setGrid((current) =>
        current.cols === cols && current.rows === rows && current.width === width
          ? current
          : { cols, rows, width }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [railRef])

  return grid
}

/** „pátek 20. 11. · 14:32" — obnovuje se po půl minutě. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const dayFormat = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
})
const timeFormat = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" })

/**
 * Hledání jako malý obchod (20. 11. 2026, Matěj).
 *
 * Okno je sloupec o třech pásech:
 * - hlavička: počet, aktivní filtry jako pilulky s křížkem (na telefonu se
 *   posouvají do stran) a vpravo kulaté „Zavřít" jako v kontaktu;
 * - obsah: karty z obchodu (zmenšené, `compact`) ve 2 řadách po 4 sloupcích,
 *   pás se táhne myší a posouvá prstem; vlevo filtry jako v obchodě (cena, výběr, kolekce)
 *   (na telefonu vyjedou přes okno, „Hotovo" je zavře a okno zůstane);
 * - patička: vlevo „Přejít do obchodu", vpravo den, čas a počet výrobků.
 *
 * Enter / „Hledat" výsledky krátce oživí (událost `kz:hledat`).
 */
function SearchContent({
  isLoading,
  loadError,
  onClose,
  onQueryChange,
  onRetry,
  products: catalogueProducts,
  query,
}: SearchContentProps) {
  const copy = useCopyBlock("global.hledani")
  const text = (label: keyof typeof SEARCH_DEFAULTS) =>
    itemText(copy, label, SEARCH_DEFAULTS[label])
  const railRef = useDragScroll<HTMLDivElement>()
  const grid = useRailGrid(railRef)
  const now = useNow()
  const [activeFacets, setActiveFacets] = useState<string[]>([])
  const [activeTaxonomy, setActiveTaxonomy] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState("")
  const { countryCode } = useParams<{ countryCode?: string }>() ?? {}
  const priceLabel = priceRangeLabel(priceRange, priceScaleFor(countryCode).unit)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pulse, setPulse] = useState(0)

  /* Enter v poli i „Hledat" vedle něj — výsledky se krátce oživí a pás
     se vrátí na začátek, ať je vidět, že se hledalo. */
  useEffect(() => {
    const hledat = () => {
      setPulse((value) => value + 1)
      railRef.current?.scrollTo({ left: 0 })
    }
    window.addEventListener("kz:hledat", hledat)
    return () => window.removeEventListener("kz:hledat", hledat)
  }, [railRef])

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  /* Druh kusu (Poškozené / Balíčky / Zakázky) jen jeden naráz, jako v obchodě. */
  const toggleFacet = (id: string) =>
    setActiveFacets((list) =>
      list.includes(id)
        ? list.filter((item) => item !== id)
        : [...list.filter((item) => !(KIND_FACETS.has(id) && KIND_FACETS.has(item))), id]
    )

  const clearAll = () => {
    setActiveFacets([])
    setActiveTaxonomy([])
    setPriceRange("")
    onQueryChange("")
  }

  const trimmedQuery = query.trim()
  const filterCount = activeFacets.length + activeTaxonomy.length + (priceRange ? 1 : 0)
  const hasFilters = filterCount > 0 || Boolean(trimmedQuery)

  const products = useMemo(() => {
    const ranked = rankBySearch(catalogueProducts, query, searchFieldsOfHit)
    const byTaxonomy = activeTaxonomy.length
      ? ranked.filter((hit) => {
          const names = [...getCategoryNames(hit), getCollectionName(hit)].filter(Boolean)
          return names.some((name) => activeTaxonomy.includes(name as string))
        })
      : ranked
    return activeFacets.length || priceRange
      ? byTaxonomy.filter((product) => matchesFacets(product, activeFacets, priceRange))
      : byTaxonomy
  }, [catalogueProducts, query, activeFacets, activeTaxonomy, priceRange])

  /* Kategorie a kolekce z katalogu, nejčastější nahoře. */
  const taxonomy = useMemo(() => {
    const counts = new Map<string, { label: string; type: "Kategorie" | "Kolekce"; n: number }>()
    for (const hit of catalogueProducts) {
      for (const name of getCategoryNames(hit)) {
        const entry = counts.get(name) ?? { label: name, type: "Kategorie" as const, n: 0 }
        entry.n += 1
        counts.set(name, entry)
      }
      const collection = getCollectionName(hit)
      if (collection) {
        const entry = counts.get(collection) ?? { label: collection, type: "Kolekce" as const, n: 0 }
        entry.n += 1
        counts.set(collection, entry)
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.n - a.n).slice(0, 14)
  }, [catalogueProducts])

  const resultLabel = trimmedQuery || filterCount
    ? products.length > 0
      ? `${products.length} ${products.length === 1 ? "nalezený výrobek" : products.length < 5 ? "nalezené výrobky" : "nalezených výrobků"}`
      : text("nic")
    : `${catalogueProducts.length} výrobků v nabídce`

  const storeHref = trimmedQuery ? `/store?search=${encodeURIComponent(trimmedQuery)}` : "/store"

  /* Málo výsledků (vejdou se na jednu obrazovku) → po řádcích, ať první
     řada začne vlevo nahoře; jinak po sloupcích, ať se táhne do strany. */
  const fitsOneScreen = products.length <= grid.cols * grid.rows
  const railStyle = {
    "--rail-cols": grid.cols,
    "--rail-rows": grid.rows,
    "--rail-col": grid.width
      ? `${(grid.width - (grid.cols - 1) * RAIL_GAP) / grid.cols}px`
      : undefined,
  } as React.CSSProperties

  return (
    <div className={styles.shop}>
      <header className={styles.shopHead}>
        <p className={styles.shopCount} aria-live="polite">
          {isLoading ? "Načítám…" : resultLabel}
        </p>
        <div className={styles.activePills} data-lenis-prevent>
          {trimmedQuery && (
            <button type="button" onClick={() => onQueryChange("")} aria-label={`Zrušit hledání „${trimmedQuery}"`}>
              <span>„{trimmedQuery}“</span>
              <i aria-hidden="true">×</i>
            </button>
          )}
          {activeTaxonomy.map((label) => (
            <button key={`t-${label}`} type="button" onClick={() => setActiveTaxonomy((list) => toggle(list, label))} aria-label={`Zrušit filtr ${label}`}>
              <span>{label}</span>
              <i aria-hidden="true">×</i>
            </button>
          ))}
          {activeFacets.map((id) => (
            <button key={`f-${id}`} type="button" onClick={() => toggleFacet(id)} aria-label={`Zrušit filtr ${facetLabel(id)}`}>
              <span>{facetLabel(id)}</span>
              <i aria-hidden="true">×</i>
            </button>
          ))}
          {priceLabel && (
            <button type="button" onClick={() => setPriceRange("")} aria-label={`Zrušit filtr ceny ${priceLabel}`}>
              <span>{priceLabel}</span>
              <i aria-hidden="true">×</i>
            </button>
          )}
          {!hasFilters && <span className={styles.pillsHint}>Bez filtrů</span>}
        </div>
        <button
          type="button"
          className={styles.filtersToggle}
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
        >
          Filtry{filterCount ? ` (${filterCount})` : ""}
        </button>
        <button
          type="button"
          className={styles.closeX}
          onClick={onClose}
          aria-label="Zavřít vyhledávání"
          title="Zavřít"
        >
          <i aria-hidden="true" />
        </button>
      </header>

      <div className={styles.shopBody}>
        <div className={styles.railCol}>
        <div
          ref={railRef}
          className={styles.rail}
          style={railStyle}
          data-testid="navbar-search-rail"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.div key="loading" className={`${styles.shopTrack} ${styles.shopTrackRows}`} initial={fadeOnly} animate={fadeIn} exit={fadeOnly}>
                {Array.from({ length: grid.cols * grid.rows }, (_, index) => (
                  <div className={styles.shopSkeleton} key={index}>
                    <i />
                    <span />
                  </div>
                ))}
              </motion.div>
            ) : loadError ? (
              <motion.div key="error" className={styles.empty} initial={riseFrom} animate={riseTo} exit={fadeOnly} role="alert">
                <span>Něco se zaseklo.</span>
                <button type="button" onClick={onRetry}>
                  Zkusit znovu <i>↻</i>
                </button>
                <LocalizedClientLink href="/store">Pokračovat do obchodu</LocalizedClientLink>
              </motion.div>
            ) : products.length > 0 ? (
              <motion.div
                key={`${normalizeSearch(query) || "vse"}:${pulse}:${activeFacets.join()}:${activeTaxonomy.join()}:${priceRange}`}
                className={`${styles.shopTrack} ${fitsOneScreen ? styles.shopTrackRows : ""}`}
                data-testid="navbar-search-results"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {products.map((hit, index) => (
                  <motion.div
                    className={styles.shopSlot}
                    key={hit.objectID ?? hit.id ?? `${hit.handle}-${index}`}
                    variants={index < 12 ? itemVariants : undefined}
                  >
                    <ProductCard product={hit as any} priority={index < 4} compact />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div key="empty" className={styles.empty} initial={riseFrom} animate={riseTo} exit={fadeOnly}>
                <span {...editableItem(copy, "prazdne")}>{text("prazdne")}</span>
                <button type="button" onClick={clearAll}>
                  {text("prazdne.tlacitko")} <i>→</i>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <RailScrollbar
          railRef={railRef}
          watch={`${isLoading}:${products.length}:${grid.cols}:${grid.rows}:${pulse}:${activeFacets.join()}:${activeTaxonomy.join()}:${priceRange}:${query}`}
        />
        </div>

        <aside
          className={`${styles.shopFilters} ${filtersOpen ? styles.shopFiltersOpen : ""}`}
          aria-label="Filtry hledání"
          data-lenis-prevent
        >
          <div className={styles.shopFiltersHead}>
            <div>
              <span>Upřesnit</span>
              <h2>Filtry</h2>
            </div>
            <button type="button" className={styles.filtersDone} onClick={() => setFiltersOpen(false)}>
              Hotovo
            </button>
          </div>

          {taxonomy.length > 0 && (
            <div className={styles.filterGroup}>
              <header>
                <h3 {...editableItem(copy, "prochazet")}>{text("prochazet")}</h3>
                {activeTaxonomy.length > 0 && <small>{activeTaxonomy.length}</small>}
              </header>
              {(["Kolekce", "Kategorie"] as const).map((type) => {
                const items = taxonomy.filter((item) => item.type === type)
                if (!items.length) return null
                return (
                  <div key={type}>
                    <p className={styles.filterSub}>{type}</p>
                    <div className={styles.filterList}>
                      {items.map((item) => {
                        const active = activeTaxonomy.includes(item.label)
                        return (
                          <button
                            key={`${item.type}-${item.label}`}
                            type="button"
                            className={active ? styles.filterActive : undefined}
                            aria-pressed={active}
                            title={item.label}
                            onClick={() => setActiveTaxonomy((list) => toggle(list, item.label))}
                          >
                            <i aria-hidden="true" />
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Cena a Výběr — tytéž ovládací prvky jako filtry obchodu. */}
          <div className={styles.filterGroup}>
            <header>
              <h3>Cena</h3>
              {priceRange && <small>1</small>}
            </header>
            <PriceFilter value={priceRange} onChange={setPriceRange} />
          </div>

          <div className={styles.filterGroup}>
            <header>
              <h3>Výběr</h3>
              {activeFacets.length > 0 && <small>{activeFacets.length}</small>}
            </header>
            <div className={styles.filterToggles}>
              {FACETS.map((facet) => (
                <Toggle
                  key={facet.id}
                  label={facet.label}
                  active={activeFacets.includes(facet.id)}
                  onClick={() => toggleFacet(facet.id)}
                />
              ))}
            </div>
          </div>

          {hasFilters && (
            <button type="button" className={styles.clearFilters} onClick={clearAll}>
              Vymazat filtry
            </button>
          )}
        </aside>
      </div>

      <footer className={styles.shopFoot}>
        <LocalizedClientLink href={storeHref} className={styles.toStore} data-testid="search-to-store" onClick={onClose}>
          Přejít do obchodu <span aria-hidden="true">→</span>
        </LocalizedClientLink>
        <p className={styles.shopInfo}>
          <span>{dayFormat.format(now)} · {timeFormat.format(now)}</span>
          <span>{catalogueProducts.length || "—"} výrobků v nabídce</span>
          <span>ručně z dílny v Putimi</span>
        </p>
      </footer>
    </div>
  )
}

export default function NavbarSearch({
  countryCode,
  isOpen: openedByVisitor,
  onClose,
  onQueryChange,
  query,
}: NavbarSearchProps) {
  /*
   * Povrch „Hledání v menu" ve Studiu (`valecms.config.ts`, `surfaces`):
   * hledání se v rámu otevře samo, texty v něm jdou upravit klikáním. Mimo
   * rám Studia vždycky `false`, takže `isOpen` je pro návštěvníka totéž co dřív.
   */
  const studioOpen = useStudioSurface("hledani")
  const isOpen = openedByVisitor || studioOpen
  const [products, setProducts] = useState<NavbarProductHit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const loadedCountry = useRef<string | null>(null)
  const requestSequence = useRef(0)
  const [entranceComplete, setEntranceComplete] = useState(false)

  // TODO(search-service): Replace this catalogue fallback with the indexed
  // search provider once its server and product index are reliable. Keep the
  // local result UI as the visual/loading/error fallback.
  const loadCatalogue = useCallback(async () => {
    const requestId = ++requestSequence.current
    setIsLoading(true)
    setLoadError(false)

    try {
      const completeCatalogue: NavbarProductHit[] = []
      const knownIds = new Set<string>()
      let offset = 0
      let total = Number.POSITIVE_INFINITY

      while (offset < total) {
        const page = await listStoreCatalogue({
          filters: fallbackFilters,
          limit: CATALOGUE_PAGE_SIZE,
          offset,
          countryCode,
        })

        if (requestId !== requestSequence.current) return

        page.products.forEach((product) => {
          const identity = product.id ?? product.handle
          if (!identity || knownIds.has(identity)) return

          knownIds.add(identity)
          completeCatalogue.push(product)
        })

        total = page.count
        if (page.products.length === 0) break
        offset += page.products.length
      }

      if (requestId !== requestSequence.current) return

      setProducts(completeCatalogue)
      loadedCountry.current = countryCode
    } catch (error) {
      if (requestId !== requestSequence.current) return
      console.error("Navbar catalogue fallback failed", error)
      setLoadError(true)
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false)
    }
  }, [countryCode])

  useEffect(() => {
    if (
      !isOpen ||
      loadedCountry.current === countryCode ||
      isLoading ||
      loadError
    ) {
      return
    }

    void loadCatalogue()
  }, [countryCode, isLoading, isOpen, loadCatalogue, loadError])

  useEffect(() => {
    loadedCountry.current = null
    setProducts([])
    setLoadError(false)
  }, [countryCode])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  /*
   * Ťuknutí MIMO hledání ho zavře (19. 11. 2026, Matěj: „on phones, when you
   * click outside the component close it"). Podklad za panelem to uměl jen
   * kliknutím — a s otevřenou klávesnicí na iPhonu klik na podklad často
   * nedošel. `touchstart` přijde vždycky, i když se prst hned rozjede.
   * Mimo = ani panel výsledků, ani pole hledání v liště (to se přepíná samo).
   * Ve Studiu (`studioOpen`) zůstává otevřené — tam ho drží rám.
   */
  const panelRef = useRef<HTMLDivElement>(null)

  /*
   * Poloměr rohů okna — poloviční proti dřívějšku (20. 11. 2026, Matěj:
   * „roh ukusuje obsah"). Musí být stejné číslo v CSS (.panel) i v ořezu
   * animace níž, jinak ořez (dřív pevně 30 px na 22px telefonním okně)
   * ukusuje rohy obsahu i po otevření.
   */
  const [panelRadius, setPanelRadius] = useState(PANEL_RADIUS)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(max-width: 720px)")
    const sync = () => setPanelRadius(query.matches ? PANEL_RADIUS_NARROW : PANEL_RADIUS)
    sync()
    query.addEventListener?.("change", sync)
    return () => query.removeEventListener?.("change", sync)
  }, [])

  /*
   * Stránka pod otevřeným hledáním stojí (19. 11. 2026, Matěj: „ať to
   * nescrolluje pod tím na stránce"). Tah ve výsledcích nebo na podkladu
   * propadal na stránku za nimi.
   *
   * Univerzální zámek pro iOS: `overflow: hidden` na body starší Safari
   * (do iOS 16) ignoruje a `overscroll-behavior` neznají vůbec — spolehlivě
   * funguje jen body s `position: fixed` posunuté o aktuální polohu. Poloha
   * se uloží a po zavření vrátí, takže stránka neposkočí. Při odchodu na
   * výrobek pak odroluje nahoru `ScrollResetOnRoute` jako vždy.
   */
  useScrollLock(openedByVisitor)

  useEffect(() => {
    if (!openedByVisitor) return
    const onOutside = (event: Event) => {
      const target = event.target as Element | null
      const el = target && target.nodeType === 1 ? target : target?.parentElement
      if (!el) return
      if (panelRef.current?.contains(el)) return
      if (el.closest("[data-search-control]")) return
      onClose()
    }
    document.addEventListener("touchstart", onOutside, { capture: true, passive: true })
    document.addEventListener("mousedown", onOutside, true)
    return () => {
      document.removeEventListener("touchstart", onOutside, true)
      document.removeEventListener("mousedown", onOutside, true)
    }
  }, [openedByVisitor, onClose])

  useEffect(() => {
    if (!isOpen) {
      setEntranceComplete(false)
      return
    }

    const timeout = window.setTimeout(() => setEntranceComplete(true), 1250)
    return () => window.clearTimeout(timeout)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          id="navbar-search"
          className={styles.root}
          /* Lenis handles the wheel on a document-level listener and scrolls programmatically,
             so preventDefault() in the rail cannot stop it and the page drifts behind the open
             overlay. This attribute is the only thing Lenis honours as an opt-out. */
          data-lenis-prevent
          {...surfaceRoot("hledani")}
          initial={fadeOnly}
          animate={fadeIn}
          exit={fadeOnly}
          transition={backdropTransition}
          aria-label="Vyhledávání produktů"
        >
          <button
            className={styles.backdrop}
            type="button"
            aria-label="Zavřít vyhledávání"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className={styles.panel}
            initial={{
              opacity: 0.72,
              y: -12,
              clipPath: `inset(0 0 100% 0 round ${panelRadius}px)`,
            }}
            animate={{
              opacity: 1,
              y: 0,
              clipPath: `inset(0 0 0% 0 round ${panelRadius}px)`,
            }}
            exit={{
              opacity: 0,
              y: -8,
              clipPath: `inset(0 0 100% 0 round ${panelRadius}px)`,
            }}
            transition={panelTransition}
          >
            <SearchContent
              entranceComplete={entranceComplete}
              isLoading={isLoading}
              loadError={loadError}
              onClose={onClose}
              onQueryChange={onQueryChange}
              onRetry={loadCatalogue}
              products={products}
              query={query}
            />
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
