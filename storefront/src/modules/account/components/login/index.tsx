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
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"


type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  redirectTo?: string
  /** Blok `ucet.formular` — položky `prihlaseni.*` (viz LOGIN_DEFAULTS). */
  copy?: CopyBlock
}

/**
 * Věty formuláře přihlášení — výchozí texty položek `prihlaseni.*` bloku
 * `ucet.formular`. Popisky polí a chybové hlášky zůstávají v kódu.
 */
const LOGIN_DEFAULTS = {
  "prihlaseni.nadpis": "Vítejte zpět",
  "prihlaseni.text": "Vaše objednávky, adresy i uložené kousky na jednom místě.",
  "prihlaseni.tlacitko": "Přihlásit se",
  "prihlaseni.bez-uctu": "Ještě nemáte účet?",
  "prihlaseni.zalozit": "Založte si účet",
  "prihlaseni.zapomenute": "Zapomněli jste heslo?",
} as const

const Login = ({ setCurrentView, redirectTo, copy }: Props) => {
  const [message, formAction] = useActionState(login, null)
  const text = (label: keyof typeof LOGIN_DEFAULTS) =>
    itemText(copy, label, LOGIN_DEFAULTS[label])
  const edit = (label: keyof typeof LOGIN_DEFAULTS) => editableItem(copy, label)

  return (
    <div className={s.root} data-testid="login-page">
      <motion.h1
        className={s.title}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.eyebrow}
        {...edit("prihlaseni.nadpis")}
      >
        {text("prihlaseni.nadpis")}
      </motion.h1>
      <motion.p
        className={s.desc}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.heading}
        {...edit("prihlaseni.text")}
      >
        {text("prihlaseni.text")}
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
            selectAllOnDoubleClick
            data-testid="email-input"
          />
          <Input
            label="Heslo"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            selectAllOnDoubleClick
            data-testid="password-input"
          />
        </div>
        <ErrorMessage error={message} data-testid="login-error-message" />
        <PremiumActionButton
          type="submit"
          text={text("prihlaseni.tlacitko")}
          className={s.submit}
          data-testid="sign-in-button"
        />
      </motion.form>
      <span className={s.note}>
        <span {...edit("prihlaseni.bez-uctu")}>{text("prihlaseni.bez-uctu")}</span>{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className={s.underline}
          data-testid="register-button"
          {...edit("prihlaseni.zalozit")}
        >
          {text("prihlaseni.zalozit")}
        </button>
        .
      </span>
      <div className={s.forgotWrap}>
        {/* Was a <button> wrapping a link — two nested controls, announced as neither. */}
        <LocalizedClientLink
          href="/forgot-password"
          className={s.underline}
          {...edit("prihlaseni.zapomenute")}
        >
          {text("prihlaseni.zapomenute")}
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Login
