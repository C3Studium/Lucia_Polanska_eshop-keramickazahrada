"use client"

import type { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import ProductCard from "../ProductCard"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import styles from "./style.module.scss"

/**
 * Texty prázdného výsledku, chyby načtení a záložní texty karet — položky
 * bloku `obchod.katalog`. Počty („Načteno 16 z 40") a stav načítání jsou
 * v kódu.
 */
const GRID_DEFAULTS = {
  "prazdne.stitek": "Nic jsme nenašli",
  "prazdne.nadpis": "Zkuste ubrat filtry.",
  "prazdne.text":
    "Tomuto výběru neodpovídá žádný výrobek. Zrušte filtry a podívejte se na celou nabídku.",
  "prazdne.tlacitko": "Zobrazit všechno",
  "chyba.stitek": "Načítání se nepovedlo",
  "chyba.nadpis": "Výrobky se nepodařilo načíst.",
  "chyba.text":
    "Vaše nastavené filtry zůstávají. Zkuste stránku načíst znovu, nebo se vraťte na celou nabídku.",
  "karta.druh": "Autorská keramika",
  "karta.popis": "Ručně vyrobený originál z píseckého ateliéru.",
} as const

/* Stable references: these are re-read by framer-motion on every grid render, and the grid
   re-renders on each filter change, refresh tick and load-more. */
const fadeIn = { opacity: 0 }
const fadeTo = { opacity: 1 }
const gridTransition = { duration: 0.25 }
const dimmed = { opacity: 0.46 }
const undimmed = { opacity: 1 }

type ProductGridProps = {
  products: HttpTypes.StoreProduct[]
  loading: boolean
  refreshing: boolean
  loadError: boolean
  canLoadMore: boolean
  total: number
  loadedCount: number
  onLoadMore: () => void
  onRetry: () => void
  onReset: () => void
  /** Kam vede karta (režim výběru do úpravy objednávky); jinak stránka produktu. */
  productHref?: (product: HttpTypes.StoreProduct) => string
  /** Karty bez košíku a oblíbených (režim výběru — nic se nekupuje). */
  hideCardActions?: boolean
  /** Blok `obchod.katalog` (viz GRID_DEFAULTS). Režim výběru ho nepředává. */
  copy?: CopyBlock
}

export default function ProductGrid({ products, loading, refreshing, loadError, canLoadMore, total, loadedCount, onLoadMore, onRetry, onReset, productHref, hideCardActions = false, copy }: ProductGridProps) {
  const text = (label: keyof typeof GRID_DEFAULTS) => itemText(copy, label, GRID_DEFAULTS[label])
  const edit = (label: keyof typeof GRID_DEFAULTS) => editableItem(copy, label)

  if (refreshing && !products.length) {
    return <ProductSkeleton />
  }

  if (loadError && !products.length) {
    return (
      <motion.div className={styles.empty} initial={fadeIn} animate={fadeTo} role="alert">
        <span {...edit("chyba.stitek")}>{text("chyba.stitek")}</span>
        <h2 {...edit("chyba.nadpis")}>{text("chyba.nadpis")}</h2>
        <p {...edit("chyba.text")}>{text("chyba.text")}</p>
        <div className={styles.emptyActions}>
          <button type="button" onClick={onRetry}>Načíst znovu <i>↻</i></button>
          <button type="button" onClick={onReset}>Zrušit filtry <i>→</i></button>
        </div>
      </motion.div>
    )
  }

  if (!products.length && !loading && !refreshing) {
    return (
      <motion.div className={styles.empty} initial={fadeIn} animate={fadeTo}>
        <span {...edit("prazdne.stitek")}>{text("prazdne.stitek")}</span>
        <h2 {...edit("prazdne.nadpis")}>{text("prazdne.nadpis")}</h2>
        <p {...edit("prazdne.text")}>{text("prazdne.text")}</p>
        {/* Bez úpravy v místě — tlačítko nese i šipku. */}
        <button type="button" onClick={onReset}>{text("prazdne.tlacitko")} <i>→</i></button>
      </motion.div>
    )
  }

  /* Záložní texty karty (jen když výrobek vlastní nemá) — jako řetězce, ne
     blok: karta je `memo` a řetězec se porovná hodnotou. Karta je odkaz,
     takže se v místě neupravují; mění se ve formuláři bloku. */
  const fallbackType = text("karta.druh")
  const fallbackDescription = text("karta.popis")

  return (
    <div className={styles.results} aria-busy={refreshing || loading}>
      <AnimatePresence>
        {refreshing && (
          <motion.div className={styles.refreshing} role="status" initial={fadeIn} animate={fadeTo} exit={fadeIn}>
            Načítám další
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className={styles.grid} animate={refreshing ? dimmed : undimmed} transition={gridTransition}>
        <AnimatePresence mode="popLayout">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index < 4}
              href={productHref?.(product)}
              hideActions={hideCardActions}
              fallbackType={fallbackType}
              fallbackDescription={fallbackDescription}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {loadError && products.length > 0 && (
        <div className={styles.inlineError} role="alert">
          <span>Další výrobky se nepovedlo načíst.</span>
          <button type="button" onClick={onRetry}>Zkusit znovu</button>
        </div>
      )}

      {(canLoadMore || loading) && (
        <div className={styles.loadMore}>
          <div className={styles.progress}><i style={{ width: `${Math.min(100, total ? loadedCount / total * 100 : 100)}%` }} /></div>
          <p aria-live="polite">{`Načteno ${Math.min(loadedCount, total)} z ${Math.max(total, loadedCount)} výrobků`}</p>
          <button type="button" onClick={onLoadMore} disabled={loading}>
            {loading ? "Načítám…" : "Zobrazit další"}<span>↓</span>
          </button>
        </div>
      )}
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className={styles.skeletonGrid} role="status" aria-label="Načítám produkty">
      {Array.from({ length: 8 }, (_, index) => (
        <div className={styles.skeletonCard} key={index}>
          <div />
          <span />
          <i />
        </div>
      ))}
    </div>
  )
}
