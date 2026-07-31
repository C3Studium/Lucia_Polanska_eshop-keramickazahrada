import SkeletonCartTotals from "@modules/skeletons/components/skeleton-cart-totals"
import s from "../../style.module.scss"

const SkeletonOrderInformation = () => {
  return (
    <section className={s.orderInformation} aria-hidden="true">
      <div className={s.deliveryBlock}>
        <span className={`${s.block} ${s.lineSm}`} />
        <span className={`${s.block} ${s.titleMd}`} />
        <div className={s.deliveryGrid}>
          {[0, 1, 2].map((item) => (
            <div className={s.deliveryCell} key={item}>
              <span className={`${s.block} ${s.lineSm}`} />
              <span className={`${s.block} ${s.lineMd}`} />
              <span className={`${s.block} ${s.lineSm}`} />
            </div>
          ))}
        </div>
      </div>
      <aside className={`${s.orderReceipt} ${s.darkSurface}`}>
        <span className={`${s.block} ${s.lineMd}`} />
        <div className={s.receiptTitle}>
          <span className={`${s.block} ${s.lineSm}`} />
          <span className={`${s.block} ${s.titleMd}`} />
        </div>
        <SkeletonCartTotals />
      </aside>
    </section>
  )
}

export default SkeletonOrderInformation
