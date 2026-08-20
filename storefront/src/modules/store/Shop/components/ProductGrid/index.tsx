"use client"

import type { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import ProductCard from "../ProductCard"
import styles from "./style.module.scss"

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
}

export default function ProductGrid({ products, loading, refreshing, loadError, canLoadMore, total, loadedCount, onLoadMore, onRetry, onReset }: ProductGridProps) {
  if (refreshing && !products.length) {
    return <ProductSkeleton />
  }

  if (loadError && !products.length) {
    return (
      <motion.div className={styles.empty} initial={fadeIn} animate={fadeTo} role="alert">
        <span>Načítání se nepovedlo</span>
        <h2>Výrobky se nepodařilo načíst.</h2>
        <p>Vaše nastavené filtry zůstávají. Zkuste stránku načíst znovu, nebo se vraťte na celou nabídku.</p>
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
        <span>Nic jsme nenašli</span>
        <h2>Zkuste ubrat filtry.</h2>
        <p>Tomuto výběru neodpovídá žádný výrobek. Zrušte filtry a podívejte se na celou nabídku.</p>
        <button type="button" onClick={onReset}>Zobrazit všechno <i>→</i></button>
      </motion.div>
    )
  }

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
          {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
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
