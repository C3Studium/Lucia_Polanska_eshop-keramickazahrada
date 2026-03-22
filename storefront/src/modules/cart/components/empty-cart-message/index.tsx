import s from "./style.module.scss"
import LinkButton from "@modules/common/components/Buttons/LinkButton"

const EmptyCartMessage = () => {
  return (
    <div className={s.root} data-testid="empty-cart-message">
      <h1 className={s.title}>Košík</h1>
      <p className={s.desc}>
        Ve vašem košíku není nic. Změňte to, použijte odkaz níže a začněte procházet naše produkty.
      </p>
      <div>
        <LinkButton href="/store" text="Prozkoumat produkty" />
      </div>
    </div>
  )
}

export default EmptyCartMessage
