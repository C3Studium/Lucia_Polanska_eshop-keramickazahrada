import s from "../../style.module.scss"

const SkeletonCodeForm = () => {
  return (
    <div className={s.codeForm} aria-hidden="true">
      <span className={`${s.block} ${s.lineMd}`} />
      <div className={s.codeInputRow}>
        <span className={s.codeField} />
        <span className={s.button} />
      </div>
    </div>
  )
}

export default SkeletonCodeForm
