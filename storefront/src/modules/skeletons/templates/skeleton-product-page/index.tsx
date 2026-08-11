import SkeletonButton from "@modules/skeletons/components/skeleton-button"
import s from "../../style.module.scss"

const SkeletonProductPage = () => {
  return (
    <main className={s.productPage} aria-busy="true" aria-live="polite">
      <span className={s.srOnly}>Načítáme výrobek.</span>
      <section className={s.productStory} aria-hidden="true">
        <aside className={s.productIdentity}>
          <div className={s.productEyebrow}>
            <span className={`${s.block} ${s.lineMd}`} />
            <span className={`${s.block} ${s.lineXs}`} />
          </div>
          <span className={`${s.block} ${s.titleLg}`} />
          <span className={`${s.block} ${s.titleMd}`} />
          <div className={s.stack}>
            <span className={`${s.block} ${s.lineFull}`} />
            <span className={`${s.block} ${s.lineFull}`} />
            <span className={`${s.block} ${s.lineMd}`} />
          </div>
        </aside>

        <div className={s.productMedia}>
          <div className={s.mediaIntro}>
            <span className={`${s.block} ${s.lineSm}`} />
            <span className={`${s.block} ${s.lineXs}`} />
          </div>
          <div className={s.mediaBlock} />
          <div className={`${s.mediaBlock} ${s.mediaBlockSmall}`} />
        </div>

        <aside className={s.productPurchase}>
          <div className={s.productEyebrow}>
            <span className={`${s.block} ${s.lineSm}`} />
            <span className={`${s.block} ${s.lineSm}`} />
          </div>
          <div className={s.stack}>
            <span className={`${s.block} ${s.lineSm}`} />
            <span className={`${s.block} ${s.titleSm}`} />
          </div>
          {[0, 1].map((group) => (
            <div className={s.optionGroup} key={group}>
              <span className={`${s.block} ${s.lineSm}`} />
              <div className={s.optionPills}>
                {[0, 1, 2, 3].map((option) => (
                  <span className={s.optionPill} key={option} />
                ))}
              </div>
            </div>
          ))}
          <SkeletonButton />
        </aside>
      </section>

      <section className={s.productChapter} aria-hidden="true">
        <div className={`${s.mediaBlock} ${s.chapterMedia}`} />
        <div className={s.chapterCopy}>
          <span className={`${s.block} ${s.lineSm}`} />
          <span className={`${s.block} ${s.titleMd}`} />
          <span className={`${s.block} ${s.lineFull}`} />
          <span className={`${s.block} ${s.lineMd}`} />
        </div>
      </section>
    </main>
  )
}

export default SkeletonProductPage
