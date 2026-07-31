import SkeletonButton from "@modules/skeletons/components/skeleton-button"
import SkeletonCartTotals from "@modules/skeletons/components/skeleton-cart-totals"
import s from "../../style.module.scss"

const Fields = ({ count = 6 }: { count?: number }) => (
  <div className={s.fieldGrid}>
    {Array.from({ length: count }, (_, index) => (
      <span
        className={`${s.field} ${
          index === count - 1 && count % 2 ? s.fieldWide : ""
        }`}
        key={index}
      />
    ))}
  </div>
)

const SkeletonCheckoutPage = () => {
  return (
    <main
      className={`${s.checkoutPage} ${s.darkSurface}`}
      aria-busy="true"
      aria-live="polite"
    >
      <span className={s.srOnly}>Načítáme pokladnu.</span>
      <div className={s.checkoutContainer}>
        <header className={s.checkoutHero} aria-hidden="true">
          <div className={s.stack}>
            <span className={`${s.block} ${s.lineMd}`} />
            <span className={`${s.block} ${s.titleLg}`} />
            <span className={`${s.block} ${s.titleMd}`} />
          </div>
          <div className={s.checkoutHeroAside}>
            <span className={`${s.block} ${s.lineFull}`} />
            <span className={`${s.block} ${s.lineFull}`} />
            <span className={`${s.block} ${s.lineMd}`} />
          </div>
        </header>

        <section className={s.checkoutLedger} aria-hidden="true">
          <div className={s.checkoutSection}>
            <header className={s.checkoutSectionHead}>
              <span className={`${s.block} ${s.lineXs}`} />
              <span className={`${s.block} ${s.titleMd}`} />
            </header>
            <Fields />
            <div className={s.summaryButton}>
              <SkeletonButton />
            </div>
          </div>
          {[2, 3, 4].map((section) => (
            <div className={s.checkoutSection} key={section}>
              <header className={s.checkoutSectionHead}>
                <span className={`${s.block} ${s.lineXs}`} />
                <span className={`${s.block} ${s.titleSm}`} />
              </header>
              <Fields count={section === 4 ? 3 : 2} />
            </div>
          ))}
        </section>

        <aside className={s.checkoutSummary} aria-hidden="true">
          <span className={`${s.block} ${s.lineMd}`} />
          <div className={s.receiptTitle}>
            <span className={`${s.block} ${s.titleMd}`} />
          </div>
          <div className={s.summaryProduct}>
            <span className={s.summaryThumb} />
            <div className={s.stack}>
              <span className={`${s.block} ${s.lineMd}`} />
              <span className={`${s.block} ${s.lineSm}`} />
              <span className={`${s.block} ${s.lineXs}`} />
            </div>
          </div>
          <SkeletonCartTotals header={false} />
        </aside>
      </div>
    </main>
  )
}

export default SkeletonCheckoutPage
