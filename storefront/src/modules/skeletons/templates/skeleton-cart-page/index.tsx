import SkeletonCartItem from "@modules/skeletons/components/skeleton-cart-item"
import SkeletonCodeForm from "@modules/skeletons/components/skeleton-code-form"
import SkeletonOrderSummary from "@modules/skeletons/components/skeleton-order-summary"
import s from "../../style.module.scss"

const SkeletonCartPage = () => {
  return (
    <main
      className={`${s.cartPage} ${s.darkSurface}`}
      aria-busy="true"
      aria-live="polite"
    >
      <span className={s.srOnly}>Načítáme váš košík.</span>
      <div className={s.cartContainer}>
        <header className={s.cartIntro} aria-hidden="true">
          <div className={s.stack}>
            <span className={`${s.block} ${s.lineMd}`} />
            <span className={`${s.block} ${s.titleLg}`} />
          </div>
          <span className={s.cartMark} />
          <div className={s.cartIntroCopy}>
            <span className={`${s.block} ${s.lineFull}`} />
            <span className={`${s.block} ${s.lineFull}`} />
            <span className={`${s.block} ${s.lineMd}`} />
          </div>
        </header>

        <div className={s.cartGrid}>
          <section className={s.cartMain} aria-hidden="true">
            <div className={s.signIn}>
              <div className={s.signInCopy}>
                <span className={`${s.block} ${s.titleSm}`} />
                <span className={`${s.block} ${s.lineMd}`} />
              </div>
              <div className={s.button} />
            </div>

            <header className={s.sectionHeading}>
              <span className={`${s.block} ${s.titleMd}`} />
              <span className={`${s.block} ${s.lineSm}`} />
            </header>
            <div className={s.cartColumnLabels}>
              <span className={`${s.block} ${s.lineSm}`} />
              <span className={`${s.block} ${s.lineXs}`} />
              <span className={`${s.block} ${s.lineXs}`} />
            </div>
            <SkeletonCartItem />
            <SkeletonCartItem />
          </section>

          <aside className={s.receipt} aria-hidden="true">
            <div className={s.receiptNote}>
              <span className={`${s.block} ${s.lineMd}`} />
            </div>
            <div className={s.receiptTitle}>
              <span className={`${s.block} ${s.lineSm}`} />
              <span className={`${s.block} ${s.titleMd}`} />
            </div>
            <SkeletonCodeForm />
            <SkeletonOrderSummary />
          </aside>
        </div>
      </div>
    </main>
  )
}

export default SkeletonCartPage
