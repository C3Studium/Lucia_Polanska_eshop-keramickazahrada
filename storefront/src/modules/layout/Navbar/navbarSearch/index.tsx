"use client"

import { listStoreCatalogue } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDragScroll } from "./useDragScroll"
import styles from "./style.module.scss"
import { alpha, palette } from "styles/palette.generated"

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

/** Facet predicates, kept beside the facet list so the two cannot drift apart. */
function matchesFacets(product: any, facets: string[]) {
  const variant = product?.variants?.[0]
  const amount = Number(
    variant?.calculated_price?.calculated_amount ?? product?.price ?? NaN
  )
  const isSale =
    variant?.calculated_price?.calculated_price?.price_list_type === "sale"
  const isNew =
    product?.created_at &&
    new Date(product.created_at).getTime() > Date.now() - 30 * 86400000

  return facets.every((facet) => {
    switch (facet) {
      case "sale":
        return Boolean(isSale)
      case "new":
        return Boolean(isNew)
      case "under-500":
        return Number.isFinite(amount) && amount < 500
      case "500-1000":
        return Number.isFinite(amount) && amount >= 500 && amount < 1000
      case "1000-2500":
        return Number.isFinite(amount) && amount >= 1000 && amount < 2500
      case "over-2500":
        return Number.isFinite(amount) && amount >= 2500
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
              ↗
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

function SearchContent({
  isLoading,
  loadError,
  onClose,
  onQueryChange,
  onRetry,
  products: catalogueProducts,
  query,
  entranceComplete,
}: SearchContentProps) {
  const normalizedQuery = normalizeSearchValue(query)
  const railRef = useDragScroll<HTMLDivElement>()
  const [activeFacets, setActiveFacets] = useState<string[]>([])

  const toggleFacet = (id: string) =>
    setActiveFacets((current) =>
      current.includes(id) ? current.filter((facet) => facet !== id) : [...current, id]
    )

  const clearAll = () => {
    setActiveFacets([])
    onQueryChange("")
  }

  const hasFilters = activeFacets.length > 0 || Boolean(query)

  const products = useMemo(() => {
    const byQuery = !normalizedQuery
      ? catalogueProducts
      : catalogueProducts.filter((product) =>
          getProductSearchValue(product).includes(normalizedQuery)
        )

    if (!activeFacets.length) return byQuery

    return byQuery.filter((product) => matchesFacets(product, activeFacets))
  }, [catalogueProducts, normalizedQuery, activeFacets])

  // The same facets the store page offers, so the overlay is not a weaker second search.
  const FACETS = [
    { id: "sale", label: "Ve slevě" },
    { id: "new", label: "Novinky" },
    { id: "under-500", label: "Do 500 Kč" },
    { id: "500-1000", label: "500–1 000 Kč" },
    { id: "1000-2500", label: "1 000–2 500 Kč" },
    { id: "over-2500", label: "Nad 2 500 Kč" },
  ] as const

  const helpers = useMemo(() => {
    const suggestions = new Map<
      string,
      { label: string; type: "Kategorie" | "Kolekce" }
    >()

    catalogueProducts.forEach((hit) => {
      getCategoryNames(hit).forEach((name) => {
        suggestions.set(`category-${name.toLocaleLowerCase("cs")}`, {
          label: name,
          type: "Kategorie",
        })
      })

      const collection = getCollectionName(hit)
      if (collection) {
        suggestions.set(`collection-${collection.toLocaleLowerCase("cs")}`, {
          label: collection,
          type: "Kolekce",
        })
      }
    })

    return Array.from(suggestions.values()).slice(0, 6)
  }, [catalogueProducts])

  /* The stagger delay is the only per-chip value, and it depends on nothing that changes while
     the customer types — so the table is built once per chip count instead of per render. */
  const chipTransitions = useMemo(
    () =>
      helpers.map((_, index) => {
        const delay = entranceComplete ? index * 0.035 : index * 0.06

        return {
          opacity: { duration: 0.48, delay, ease },
          x: { duration: 0.48, delay, ease },
          color: { duration: 0.22, delay: 0.16, ease },
        }
      }),
    [helpers, entranceComplete]
  )

  const resultLabel = normalizedQuery
    ? products.length > 0
      ? `${products.length} ${
          products.length === 1 ? "nalezený výrobek" : "nalezených výrobků"
        }`
      : "Nic jsme nenašli"
    : `${catalogueProducts.length} ${
        catalogueProducts.length === 1
          ? "výrobek v nabídce"
          : "výrobků v nabídce"
      }`


  return (
    <motion.div
      className={styles.content}
      variants={contentVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className={styles.helper}
        variants={sectionVariants}
        aria-live="polite"
      >
        {helpers.length > 0 && (
          <>
            <span className={styles.helperLabel}>Procházet podle</span>
            <motion.div className={styles.suggestions}>
              {helpers.map((helper, index) => (
                <motion.button
                  key={`${helper.type}-${helper.label}`}
                  type="button"
                  aria-pressed={query === helper.label}
                  onClick={() =>
                    onQueryChange(query === helper.label ? "" : helper.label)
                  }
                  initial={chipInitial}
                  animate="rest"
                  whileHover="hover"
                  whileFocus="hover"
                  variants={chipVariants}
                  transition={chipTransitions[index]}
                >
                  <motion.i
                    variants={chipFillVariants}
                    initial={chipFillInitial}
                    style={chipFillStyle}
                    transition={chipFillTransition}
                    aria-hidden="true"
                  />
                  <small>{helper.type}</small>
                  <span>{helper.label}</span>
                </motion.button>
              ))}
            </motion.div>

            <motion.div className={styles.facets}>
              {FACETS.map((facet) => (
                <button
                  key={facet.id}
                  type="button"
                  className={
                    activeFacets.includes(facet.id) ? styles.facetActive : undefined
                  }
                  aria-pressed={activeFacets.includes(facet.id)}
                  onClick={() => toggleFacet(facet.id)}
                >
                  {facet.label}
                </button>
              ))}

              {hasFilters && (
                <button
                  type="button"
                  className={styles.clearFilters}
                  onClick={clearAll}
                >
                  Vymazat filtry
                </button>
              )}
            </motion.div>
          </>
        )}
      </motion.div>

      <motion.div className={styles.resultsHeader} variants={sectionVariants}>
        <p aria-live="polite">
          {isLoading ? "Načítám…" : resultLabel}
        </p>
        <button type="button" onClick={onClose} aria-label="Zavřít vyhledávání">
          Zavřít
        </button>
      </motion.div>

      <motion.div
        ref={railRef}
        className={styles.quarryViewport}
        variants={sectionVariants}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="loading"
              className={styles.skeletonTrack}
              initial={fadeOnly}
              animate={fadeIn}
              exit={fadeOnly}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <div className={styles.skeleton} key={index}>
                  <i />
                  <span />
                </div>
              ))}
            </motion.div>
          ) : loadError ? (
            <motion.div
              key="error"
              className={styles.empty}
              initial={riseFrom}
              animate={riseTo}
              exit={fadeOnly}
              role="alert"
            >
              <span>Něco se zaseklo.</span>
              <button type="button" onClick={onRetry}>
                Zkusit znovu <i>↻</i>
              </button>
              <LocalizedClientLink href="/store">
                Pokračovat do obchodu
              </LocalizedClientLink>
            </motion.div>
          ) : products.length > 0 ? (
            <motion.div
              key={normalizedQuery || "complete-catalogue"}
              className={styles.quarryTrack}
              data-testid="navbar-search-results"
              variants={listVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {products.map((hit, index) => (
                <motion.div
                  className={styles.productSlot}
                  key={hit.objectID ?? hit.id ?? `${hit.handle}-${index}`}
                  variants={itemVariants}
                >
                  <ProductQuarry hit={hit} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className={styles.empty}
              initial={riseFrom}
              animate={riseTo}
              exit={fadeOnly}
            >
              <span>Zkuste jiný název, kategorii nebo kolekci.</span>
              <button type="button" onClick={() => onQueryChange("")}>
                Zobrazit všechno <i>→</i>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

export default function NavbarSearch({
  countryCode,
  isOpen,
  onClose,
  onQueryChange,
  query,
}: NavbarSearchProps) {
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
            className={styles.panel}
            initial={{
              opacity: 0.72,
              y: -12,
              clipPath: "inset(0 0 100% 0 round 30px)",
            }}
            animate={{
              opacity: 1,
              y: 0,
              clipPath: "inset(0 0 0% 0 round 30px)",
            }}
            exit={{
              opacity: 0,
              y: -8,
              clipPath: "inset(0 0 100% 0 round 30px)",
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
