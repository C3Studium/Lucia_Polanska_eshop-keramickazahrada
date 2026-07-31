import SkeletonButton from "@modules/skeletons/components/skeleton-button"
import s from "../../style.module.scss"

const SkeletonExpressCheckout = () => {
  return (
    <main className={s.expressSkeleton} aria-busy="true" aria-live="polite">
      <span className={s.srOnly}>Načítáme rychlý nákup.</span>
      <header className={s.expressHero} aria-hidden="true">
        <span className={`${s.block} ${s.lineMd}`} />
        <span className={`${s.block} ${s.titleLg}`} />
        <span className={`${s.block} ${s.titleMd}`} />
        <div className={s.stack}>
          <span className={`${s.block} ${s.lineFull}`} />
          <span className={`${s.block} ${s.lineFull}`} />
          <span className={`${s.block} ${s.lineMd}`} />
        </div>
      </header>

      <div className={s.expressProgress} aria-hidden="true">
        {[0, 1, 2].map((step) => (
          <div className={s.expressProgressCell} key={step}>
            <span className={`${s.block} ${s.lineSm}`} />
          </div>
        ))}
      </div>

      <section className={s.expressCard} aria-hidden="true">
        <header className={s.expressCardHead}>
          <span className={`${s.block} ${s.titleSm}`} />
          <span className={s.quantityPill} />
        </header>
        <div className={`${s.mediaBlock} ${s.expressMedia}`} />
        <div className={s.stack}>
          <span className={`${s.block} ${s.lineSm}`} />
          <span className={`${s.block} ${s.titleMd}`} />
        </div>
        <div className={s.optionGroup}>
          <span className={`${s.block} ${s.lineSm}`} />
          <div className={s.optionPills}>
            {[0, 1, 2, 3].map((option) => (
              <span className={s.optionPill} key={option} />
            ))}
          </div>
        </div>
        <div className={s.expressControls}>
          <span className={s.quantityPill} />
          <SkeletonButton />
        </div>
      </section>
    </main>
  )
}

export default SkeletonExpressCheckout
