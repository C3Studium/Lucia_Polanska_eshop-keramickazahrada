"use client"

import { listStoreCatalogue } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styles from "./style.module.scss"

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

export function ProductQuarry({ hit }: { hit: NavbarProductHit }) {
  const category = getCategoryNames(hit)[0]
  const collection = getCollectionName(hit)
  const href = hit.handle ? `/products/${hit.handle}` : "/store"
  const [isActive, setIsActive] = useState(false)

  return (
    <motion.div
      className={styles.productMotion}
      initial="rest"
      animate={isActive ? "hover" : "rest"}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocusCapture={() => setIsActive(true)}
      onBlurCapture={() => setIsActive(false)}
      variants={{
        rest: { y: 0, color: "#20211c" },
        hover: { y: -4, color: "#20211c" },
      }}
      transition={{
        y: { duration: 0.5, ease },
        color: { duration: 0.24, ease },
      }}
    >
      <LocalizedClientLink
        href={href}
        className={styles.product}
        data-testid="navbar-search-result"
      >
        <motion.span
          className={styles.productSurface}
          variants={{
            rest: { scaleX: 0, opacity: 0 },
            hover: { scaleX: 1, opacity: 1 },
          }}
          style={{ originX: 0 }}
          transition={{ duration: 0.62, ease: revealEase }}
          aria-hidden="true"
        />
        <div className={styles.thumbnailWrap}>
          <motion.div
            className={styles.thumbnailMotion}
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.035 },
            }}
            transition={{ duration: 0.72, ease }}
          >
            <Thumbnail
              thumbnail={hit.thumbnail ?? null}
              size="square"
              className={styles.thumbnail}
            />
          </motion.div>
          <span className={styles.productIndex} aria-hidden="true">
            Objekt
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
              variants={{
                rest: {
                  x: 0,
                  rotate: 0,
                  color: "#20211c",
                  backgroundColor: "rgba(32, 33, 28, 0)",
                },
                hover: {
                  x: 3,
                  rotate: 45,
                  color: "#fff1e7",
                  backgroundColor: "#20211c",
                },
              }}
              transition={{ duration: 0.44, ease }}
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

  const products = useMemo(() => {
    if (!normalizedQuery) return catalogueProducts

    return catalogueProducts.filter((product) =>
      getProductSearchValue(product).includes(normalizedQuery)
    )
  }, [catalogueProducts, normalizedQuery])

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

  const resultLabel = normalizedQuery
    ? products.length > 0
      ? `${products.length} ${
          products.length === 1 ? "nalezený objekt" : "nalezených objektů"
        }`
      : "Nic jsme nenašli"
    : `${catalogueProducts.length} ${
        catalogueProducts.length === 1
          ? "objekt v katalogu"
          : "objektů v katalogu"
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
                  onClick={() => onQueryChange(helper.label)}
                  initial={{ opacity: 0, x: -14 }}
                  animate="rest"
                  whileHover="hover"
                  whileFocus="hover"
                  variants={{
                    rest: {
                      opacity: 1,
                      x: 0,
                      color: "#20211c",
                    },
                    hover: {
                      opacity: 1,
                      x: 0,
                      color: "#fff8ee",
                    },
                  }}
                  transition={{
                    opacity: {
                      duration: 0.48,
                      delay: entranceComplete ? index * 0.035 : index * 0.06,
                      ease,
                    },
                    x: {
                      duration: 0.48,
                      delay: entranceComplete ? index * 0.035 : index * 0.06,
                      ease,
                    },
                    color: { duration: 0.22, delay: 0.16, ease },
                  }}
                >
                  <motion.i
                    variants={{
                      hover: { scaleX: 1 },
                    }}
                    initial={{ scaleX: 0 }}
                    style={{ originX: 0 }}
                    transition={{ duration: 0.5, ease: revealEase }}
                    aria-hidden="true"
                  />
                  <small>{helper.type}</small>
                  <span>{helper.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </motion.div>

      <motion.div className={styles.resultsHeader} variants={sectionVariants}>
        <p aria-live="polite">
          {isLoading ? "Otevírám ateliérový výběr…" : resultLabel}
        </p>
        <button type="button" onClick={onClose} aria-label="Zavřít vyhledávání">
          Zavřít
        </button>
      </motion.div>

      <motion.div className={styles.quarryViewport} variants={sectionVariants}>
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="loading"
              className={styles.skeletonTrack}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
            >
              <span>Ateliér je na chvíli nedostupný.</span>
              <button type="button" onClick={onRetry}>
                Načíst produkty znovu <i>↻</i>
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span>Zkuste jiný název, kategorii nebo kolekci.</span>
              <button type="button" onClick={() => onQueryChange("")}>
                Zobrazit celý výběr <i>→</i>
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.38, ease }}
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
            transition={{ duration: 0.7, ease: revealEase }}
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
