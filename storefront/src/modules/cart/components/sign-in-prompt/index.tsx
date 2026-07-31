"use client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import s from "./style.module.scss"

const SignInPrompt = () => {
  return (
    <div className={s.root}>
      <div className={s.content}>
        <h2 className={s.title}>Máte již účet?</h2>
        <p className={s.desc}>Přihlaste se pro lepší zážitek.</p>
      </div>
      <div className={s.ctaWrap}>
        <LocalizedClientLink
          className={s.link}
          href="/account?redirectTo=/cart"
        >
          <PremiumActionButton
            compact
            text="Přihlásit se"
            type="button"
            className={s.button}
            data-testid="sign-in-button"
            onClickAction={undefined} // navigation handled by Link
          />
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
