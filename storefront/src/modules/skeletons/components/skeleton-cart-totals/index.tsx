import s from "../../style.module.scss"

type SkeletonCartTotalsProps = {
  header?: boolean
}

const SkeletonCartTotals = ({ header = true }: SkeletonCartTotalsProps) => {
  return (
    <div className={s.totals} aria-hidden="true">
      {header && <span className={`${s.block} ${s.lineMd}`} />}
      <div className={s.totalRow}>
        <span className={`${s.block} ${s.lineMd}`} />
        <span className={`${s.block} ${s.lineSm}`} />
      </div>
      <div className={s.totalRow}>
        <span className={`${s.block} ${s.lineSm}`} />
        <span className={`${s.block} ${s.lineXs}`} />
      </div>
      <div className={s.totalRow}>
        <span className={`${s.block} ${s.lineSm}`} />
        <span className={`${s.block} ${s.lineXs}`} />
      </div>
      <div className={`${s.totalRow} ${s.totalGrand}`}>
        <span className={`${s.block} ${s.lineMd}`} />
        <span className={`${s.block} ${s.lineSm}`} />
      </div>
    </div>
  )
}

export default SkeletonCartTotals
