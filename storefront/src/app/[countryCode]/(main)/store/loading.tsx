import styles from "./loading.module.scss"

export default function StoreLoading() {
  return (
    <main className={styles.root} aria-label="Načítám ateliérový obchod" aria-busy="true">
      <div className={styles.hero}>
        <span />
        <i />
        <i />
      </div>
      <div className={styles.catalogue}>
        <header><span /><i /></header>
        <div className={styles.products}>
          {Array.from({ length: 8 }, (_, index) => <div key={index} />)}
        </div>
      </div>
    </main>
  )
}

