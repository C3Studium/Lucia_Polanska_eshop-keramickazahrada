import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import s from "../../style.module.scss"

const SkeletonOrderItems = () => {
  return (
    <section className={s.orderItems} aria-hidden="true">
      <header className={s.orderSectionHead}>
        <div className={s.stack}>
          <span className={`${s.block} ${s.lineSm}`} />
          <span className={`${s.block} ${s.titleMd}`} />
        </div>
        <span className={`${s.block} ${s.lineSm}`} />
      </header>
      <div>
        <SkeletonLineItem />
        <SkeletonLineItem />
      </div>
    </section>
  )
}

export default SkeletonOrderItems
