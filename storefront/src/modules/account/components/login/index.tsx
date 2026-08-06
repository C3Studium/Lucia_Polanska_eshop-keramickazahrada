import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { useActionState } from "react"

import { motion } from "framer-motion"

import s from "./login.module.scss"
import { heroBeat, heroReveal } from "@lib/motion-tokens"


type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  redirectTo?: string
}

const Login = ({ setCurrentView, redirectTo }: Props) => {
  const [message, formAction] = useActionState(login, null)

  return (
    <div className={s.root} data-testid="login-page">
      <motion.h1
        className={s.title}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.eyebrow}
      >
        Vítejte zpět
      </motion.h1>
      <motion.p
        className={s.desc}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.heading}
      >
        Přihlaste se pro přístup k vylepšenému zážitku z nakupování.
      </motion.p>
      <motion.form
        className={s.form}
        action={formAction}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.lede}
      >
        {redirectTo && (
          <input type="hidden" name="redirect_to" value={redirectTo} />
        )}
        <div className={s.fields}>
          <Input
            label="E-mail"
            name="email"
            type="email"
            title="Zadejte platnou e-mailovou adresu."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            label="Heslo"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <ErrorMessage error={message} data-testid="login-error-message" />
        <PremiumActionButton
          type="submit"
          text="Přihlásit se"
          className={s.submit}
          data-testid="sign-in-button"
        />
      </motion.form>
      <span className={s.note}>
        Ještě nemáte účet?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className={s.underline}
          data-testid="register-button"
        >
          Připojte se k nám
        </button>
        .
      </span>
      <div className={s.forgotWrap}>
        {/* Was a <button> wrapping a link — two nested controls, announced as neither. */}
        <LocalizedClientLink href="/forgot-password" className={s.underline}>
          Zapomněli jste heslo?
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Login
