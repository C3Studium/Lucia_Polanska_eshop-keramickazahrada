import s from "../../style.module.scss"

const SkeletonOrderConfirmedHeader = () => {
  return (
    <>
      <header className={s.orderMasthead} aria-hidden="true">
        <span className={`${s.block} ${s.lineMd}`} />
        <span className={`${s.block} ${s.lineSm}`} />
      </header>
      <section className={s.orderHero} aria-hidden="true">
        <div className={s.orderHeroCopy}>
          <span className={`${s.block} ${s.lineMd}`} />
          <span className={`${s.block} ${s.titleLg}`} />
          <span className={`${s.block} ${s.titleMd}`} />
        </div>
        <div className={s.stack}>
          <span className={`${s.block} ${s.lineFull}`} />
          <span className={`${s.block} ${s.lineFull}`} />
          <span className={`${s.block} ${s.lineMd}`} />
        </div>
      </section>
      <section className={s.statusRail} aria-hidden="true">
        {[0, 1, 2].map((step) => (
          <div className={s.statusCell} key={step}>
            <span className={`${s.block} ${s.lineXs}`} />
            <div className={s.statusCopy}>
              <span className={`${s.block} ${s.lineSm}`} />
              <span className={`${s.block} ${s.lineMd}`} />
            </div>
          </div>
        ))}
      </section>
      <section className={s.orderMeta} aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div className={s.metaCell} key={item}>
            <span className={`${s.block} ${s.lineSm}`} />
            <span className={`${s.block} ${s.lineMd}`} />
          </div>
        ))}
      </section>
    </>
  )
}

export default SkeletonOrderConfirmedHeader
