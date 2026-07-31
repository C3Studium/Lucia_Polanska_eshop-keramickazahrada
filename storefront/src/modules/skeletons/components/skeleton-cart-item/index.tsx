import s from "../../style.module.scss"

const SkeletonCartItem = () => {
  return (
    <article className={s.cartItem} aria-hidden="true">
      <div className={s.lineItemMedia} />
      <div className={s.lineItemCopy}>
        <span className={`${s.block} ${s.lineSm}`} />
        <span className={`${s.block} ${s.titleSm}`} />
        <span className={`${s.block} ${s.lineMd}`} />
      </div>
      <div className={s.lineItemControl}>
        <span className={`${s.block} ${s.lineSm}`} />
        <span className={s.quantityPill} />
        <span className={`${s.block} ${s.lineMd}`} />
      </div>
      <div className={s.lineItemPrice}>
        <span className={`${s.block} ${s.lineXs}`} />
        <span className={`${s.block} ${s.lineSm}`} />
      </div>
    </article>
  )
}

export default SkeletonCartItem
