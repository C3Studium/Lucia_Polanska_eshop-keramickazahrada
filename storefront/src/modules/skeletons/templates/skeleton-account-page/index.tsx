import s from "../../style.module.scss"

type SkeletonAccountPageProps = {
  contentOnly?: boolean
}

const AccountContent = ({ contentOnly = false }: SkeletonAccountPageProps) => (
  <section
    className={contentOnly ? s.accountContentOnly : s.accountContent}
    aria-hidden="true"
  >
    <header className={s.accountHero}>
      <div className={s.stack}>
        <span className={`${s.block} ${s.lineMd}`} />
        <span className={`${s.block} ${s.titleLg}`} />
        <span className={`${s.block} ${s.titleMd}`} />
      </div>
      <div className={s.stack}>
        <span className={`${s.block} ${s.lineFull}`} />
        <span className={`${s.block} ${s.lineMd}`} />
      </div>
    </header>
    <div className={s.accountStats}>
      {[0, 1].map((stat) => (
        <div className={s.accountStat} key={stat}>
          <span className={`${s.block} ${s.lineSm}`} />
          <span className={`${s.block} ${s.titleSm}`} />
        </div>
      ))}
    </div>
    <header className={s.sectionHeading}>
      <span className={`${s.block} ${s.titleMd}`} />
      <span className={`${s.block} ${s.lineSm}`} />
    </header>
    <div className={s.accountOrders}>
      {[0, 1, 2].map((order) => (
        <div className={s.accountOrderRow} key={order}>
          <span className={`${s.block} ${s.titleSm}`} />
          <div className={s.stack}>
            <span className={`${s.block} ${s.lineXs}`} />
            <span className={`${s.block} ${s.lineSm}`} />
          </div>
          <div className={s.thumbGroup}>
            <span className={s.miniThumb} />
            <span className={s.miniThumb} />
            <span className={s.miniThumb} />
          </div>
          <span className={s.button} />
        </div>
      ))}
    </div>
  </section>
)

const SkeletonAccountPage = ({
  contentOnly = false,
}: SkeletonAccountPageProps) => {
  if (contentOnly) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className={s.srOnly}>Načítáme váš soukromý archiv.</span>
        <AccountContent contentOnly />
      </div>
    )
  }

  return (
    <main className={s.accountPage} aria-busy="true" aria-live="polite">
      <span className={s.srOnly}>Načítáme váš soukromý archiv.</span>
      <div className={s.accountFrame}>
        <aside className={s.accountNav} aria-hidden="true">
          <div className={s.accountNavTitle}>
            <span className={`${s.block} ${s.lineMd}`} />
            <span className={`${s.block} ${s.titleMd}`} />
            <span className={`${s.block} ${s.titleSm}`} />
          </div>
          <div className={s.accountNavList}>
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className={s.accountNavRow} key={item}>
                <span className={`${s.block} ${s.lineXs}`} />
                <span className={`${s.block} ${s.lineMd}`} />
                <span className={`${s.block} ${s.lineXs}`} />
              </div>
            ))}
          </div>
          <div className={s.accountNavFoot}>
            <span className={`${s.block} ${s.lineMd}`} />
            <div className={s.optionPills}>
              <span className={s.button} />
              <span className={s.button} />
            </div>
          </div>
        </aside>
        <AccountContent />
      </div>
    </main>
  )
}

export default SkeletonAccountPage
