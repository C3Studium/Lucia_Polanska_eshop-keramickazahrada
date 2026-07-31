import s from "../../style.module.scss"

const SkeletonCardDetails = () => {
  return (
    <div className={s.cardDetails} aria-hidden="true">
      <span className={`${s.block} ${s.lineSm}`} />
      <span className={s.cardDetailsField} />
    </div>
  )
}

export default SkeletonCardDetails
