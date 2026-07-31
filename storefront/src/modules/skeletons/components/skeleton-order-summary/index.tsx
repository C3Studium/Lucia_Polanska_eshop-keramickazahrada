import SkeletonButton from "@modules/skeletons/components/skeleton-button"
import SkeletonCartTotals from "@modules/skeletons/components/skeleton-cart-totals"
import s from "../../style.module.scss"

const SkeletonOrderSummary = () => {
  return (
    <div aria-hidden="true">
      <SkeletonCartTotals header={false} />
      <div className={s.summaryButton}>
        <SkeletonButton />
      </div>
    </div>
  )
}

export default SkeletonOrderSummary
