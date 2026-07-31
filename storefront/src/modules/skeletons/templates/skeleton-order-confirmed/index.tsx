import SkeletonOrderConfirmedHeader from "@modules/skeletons/components/skeleton-order-confirmed-header"
import SkeletonOrderInformation from "@modules/skeletons/components/skeleton-order-information"
import SkeletonOrderItems from "@modules/skeletons/components/skeleton-order-items"
import s from "../../style.module.scss"

const SkeletonOrderConfirmed = () => {
  return (
    <main className={s.orderPage} aria-busy="true" aria-live="polite">
      <span className={s.srOnly}>Načítáme údaje objednávky.</span>
      <div className={s.orderContainer}>
        <SkeletonOrderConfirmedHeader />
        <SkeletonOrderItems />
        <SkeletonOrderInformation />
      </div>
    </main>
  )
}

export default SkeletonOrderConfirmed
