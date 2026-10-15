"use client"

import { motion } from "framer-motion"

import { useActionState } from "react"
import Input from "@modules/common/components/input"
import PhoneInput from "@modules/common/components/phone-input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import s from "./style.module.scss"
import { heroBeat, heroReveal } from "@lib/motion-tokens"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  redirectTo?: string
  /** Blok `ucet.formular` — položky `registrace.*` (viz REGISTER_DEFAULTS). */
  copy?: CopyBlock
}

/**
 * Věty formuláře registrace — výchozí texty položek `registrace.*` bloku
 * `ucet.formular`. Souhlas se zásadami a podmínkami pod formulářem, popisky
 * polí a chybové hlášky zůstávají v kódu.
 */
const REGISTER_DEFAULTS = {
  "registrace.nadpis": "Založte si účet",
  "registrace.text":
    "Objednávky, adresy i uložené kousky budete mít na jednom místě — a příště nebudete nic vypisovat znovu.",
  "registrace.tlacitko": "Založit účet",
  "registrace.mate-ucet": "Máte už účet?",
  "registrace.prihlasit": "Přihlásit se",
} as const

const Register = ({ setCurrentView, redirectTo, copy }: Props) => {
  const [message, formAction] = useActionState(signup, null)
  const text = (label: keyof typeof REGISTER_DEFAULTS) =>
    itemText(copy, label, REGISTER_DEFAULTS[label])
  const edit = (label: keyof typeof REGISTER_DEFAULTS) => editableItem(copy, label)

  return (
    <div className={s.root} data-testid="register-page">
      <motion.h1
        className={s.title}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.eyebrow}
        {...edit("registrace.nadpis")}
      >
        {text("registrace.nadpis")}
      </motion.h1>
      <motion.p
        className={s.desc}
        variants={heroReveal}
        initial="hidden"
        animate="show"
        custom={heroBeat.heading}
        {...edit("registrace.text")}
      >
        {text("registrace.text")}
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
            selectAllOnDoubleClick
            data-testid="first-name-input"
          />
          <Input
            label="Příjmení"
            name="last_name"
            required
            autoComplete="family-name"
            selectAllOnDoubleClick
            data-testid="last-name-input"
          />
          <Input
            label="Email"
            name="email"
            required
            type="email"
            autoComplete="email"
            selectAllOnDoubleClick
            data-testid="email-input"
          />
          <PhoneInput
            selectAllOnDoubleClick
            label="Telefon"
            name="phone"
            data-testid="phone-input"
          />
          <Input
            label="Heslo"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            selectAllOnDoubleClick
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
          text={text("registrace.tlacitko")}
        />
      </motion.form>
      <span className={s.note}>
        <span {...edit("registrace.mate-ucet")}>{text("registrace.mate-ucet")}</span>{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className={s.underline}
          {...edit("registrace.prihlasit")}
        >
          {text("registrace.prihlasit")}
        </button>
        .
      </span>
    </div>
  )
}

export default Register
