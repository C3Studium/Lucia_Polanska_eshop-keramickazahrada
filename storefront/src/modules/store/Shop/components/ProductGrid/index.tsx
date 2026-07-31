"use client"

import type { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import ProductCard from "../ProductCard"
import styles from "./style.module.scss"

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
      <motion.div className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert">
        <span>Ateliér je na chvíli nedostupný</span>
        <h2>Katalog se nepodařilo otevřít.</h2>
        <p>Vaše volba zůstala zachovaná. Zkuste spojení obnovit, nebo se vraťte k celému výběru.</p>
        <div className={styles.emptyActions}>
          <button type="button" onClick={onRetry}>Načíst znovu <i>↻</i></button>
          <button type="button" onClick={onReset}>Zrušit filtry <i>→</i></button>
        </div>
      </motion.div>
    )
  }

  if (!products.length && !loading && !refreshing) {
    return (
      <motion.div className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <span>Nic jsme nenašli</span>
        <h2>Zkuste výběr trochu otevřít.</h2>
        <p>Každý objekt se nevejde do každé škatulky. Zrušte filtry a objevte celou kolekci.</p>
        <button type="button" onClick={onReset}>Zobrazit všechny objekty <i>→</i></button>
      </motion.div>
    )
  }

  return (
    <div className={styles.results} aria-busy={refreshing || loading}>
      <AnimatePresence>
        {refreshing && (
          <motion.div className={styles.refreshing} role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Aktualizuji ateliérový výběr
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className={styles.grid} animate={{ opacity: refreshing ? 0.46 : 1 }} transition={{ duration: 0.25 }}>
        <AnimatePresence mode="popLayout">
          {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
        </AnimatePresence>
      </motion.div>

      {loadError && products.length > 0 && (
        <div className={styles.inlineError} role="alert">
          <span>Další objekty se nepodařilo načíst.</span>
          <button type="button" onClick={onRetry}>Zkusit znovu</button>
        </div>
      )}

      {(canLoadMore || loading) && (
        <div className={styles.loadMore}>
          <div className={styles.progress}><i style={{ width: `${Math.min(100, total ? loadedCount / total * 100 : 100)}%` }} /></div>
          <p aria-live="polite">{`Načteno ${Math.min(loadedCount, total)} z ${Math.max(total, loadedCount)} objektů`}</p>
          <button type="button" onClick={onLoadMore} disabled={loading}>
            {loading ? "Načítám…" : "Objevit další objekty"}<span>↓</span>
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
