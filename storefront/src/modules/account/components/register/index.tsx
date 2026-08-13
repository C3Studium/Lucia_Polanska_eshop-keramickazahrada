"use client"

import { motion } from "framer-motion"

import { useActionState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import s from "./style.module.scss"
import { heroBeat, heroReveal } from "@lib/motion-tokens"
import PremiumActionButton from "@modules/common/components/premium-action-button"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  redirectTo?: string
}

const Register = ({ setCurrentView, redirectTo }: Props) => {
  const [message, formAction] = useActionState(signup, null)

  return (
    <div className={s.root} data-testid="register-page">
      <motion.h1
        className={s.title}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.eyebrow}
      >
        Založte si účet
      </motion.h1>
      <motion.p
        className={s.desc}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.heading}
      >
        Objednávky, adresy i uložené kousky budete mít na jednom místě —
        a příště nebudete nic vypisovat znovu.
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
            label="Jméno"
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label="Příjmení"
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            label="Email"
            name="email"
            required
            type="email"
            autoComplete="email"
            data-testid="email-input"
          />
          <Input
            label="Telefon"
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            label="Heslo"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        {/* Úspěšná registrace vrací objekt zákazníka — chybová lišta patří jen textu. */}
        <ErrorMessage
          error={typeof message === "string" ? message : null}
          data-testid="register-error"
        />
        <span className={s.note}>
          Vytvořením účtu souhlasíte se{" "}
          <LocalizedClientLink
            href="/ochrana-osobnich-udaju"
            className={s.underline}
          >
            Zásadami ochrany osobních údajů
          </LocalizedClientLink>{" "}
          a{" "}
          <LocalizedClientLink
            href="/smluvni-podminky"
            className={s.underline}
          >
            Podmínkami použití
          </LocalizedClientLink>
          .
        </span>
        <PremiumActionButton
          type="submit"
          className={s.submit}
          data-testid="register-button"
          text="Založit účet"
        />
      </motion.form>
      <span className={s.note}>
        Máte už účet?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className={s.underline}
        >
          Přihlásit se
        </button>
        .
      </span>
    </div>
  )
}

export default Register
