import styles from "./loading.module.scss"

/*
 * Kostra obchodu (13. 11. 2026) — stejné rozvržení jako skutečná stránka:
 * úvod (nadpis vlevo, věta vpravo), tmavý panel filtrů vlevo, lišta s počtem,
 * hledáním a řazením a mřížka karet se stejným pravidlem sloupců jako
 * ProductGrid. Dřív tu byla velká tmavá hero plocha z dřívější podoby obchodu.
 */
export default function StoreLoading() {
  return (
    <main className={styles.root} aria-label="Načítám obchod" aria-busy="true">
      <div className={styles.catalogue}>
        <header className={styles.intro}>
          <div>
            <i className={styles.eyebrow} />
            <i className={styles.title} />
            <i className={styles.titleAccent} />
          </div>
          <div className={styles.introText}>
            <i />
            <i />
            <i />
          </div>
        </header>

        <div className={styles.layout}>
          <aside className={styles.rail}>
            <i className={styles.railTitle} />
            {Array.from({ length: 8 }, (_, index) => (
              <i key={index} className={styles.railRow} />
            ))}
          </aside>

          <section className={styles.results}>
            <div className={styles.toolbar}>
              <i className={styles.count} />
              <i className={styles.search} />
              <i className={styles.sort} />
            </div>
            <div className={styles.grid}>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={styles.card}>
                  <i className={styles.image} />
                  <i className={styles.kicker} />
                  <i className={styles.cardTitle} />
                  <i className={styles.desc} />
                  <i className={styles.price} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
