"use client"

import { useActionState, useState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import s from "./style.module.scss"
import { useFormStatus } from "react-dom"
import { motion } from "framer-motion"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)

  return (
    <div className={s.root} data-testid="register-page">
      <h1 className={s.title}>
        Staňte se členem!
      </h1>
      <p className={s.desc}>
        Vytvořte si profil člena Medusa Store a získejte přístup k vylepšenému
        zážitku z nakupování.
      </p>
      <form className={s.form} action={formAction}>
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
        <ErrorMessage error={message} data-testid="register-error" />
        <span className={s.note}>
          Vytvořením účtu souhlasíte se{" "}
          <LocalizedClientLink
            href="/content/privacy-policy"
            className={s.underline}
          >
            Zásadami ochrany osobních údajů
          </LocalizedClientLink>{" "}
          a{" "}
          <LocalizedClientLink
            href="/content/terms-of-use"
            className={s.underline}
          >
            Podmínkami použití
          </LocalizedClientLink>
          .
        </span>
        <ClickButton type="submit" className={s.submit} data-testid="register-button" text="Připojit se"/>
      </form>
      <span className={s.note}>
        Již jste členem?{" "}
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


type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    "data-testid"?: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
function ClickButton({ onClickAction, ClickAction, disabled = false, text, type = "button", className, "data-testid": dataTestId }: ClickButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    const { pending } = useFormStatus();
    const isSubmitting = type === "submit" ? pending : false;
    const isDisabled = disabled || isSubmitting;
    const handleClick = onClickAction ?? ClickAction;

    return (
        <div className={className ? `${s.ClickButton} ${className}` : s.ClickButton}>
            <button
                type={type}
                className={s.button}
                onClick={handleClick}
                disabled={isDisabled}
                aria-busy={isDisabled || undefined}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                data-testid={dataTestId}
            >
                <motion.div
                    className={s.slider}
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div
                        className={s.el}
                        style={{ backgroundColor: "var(--darkOlive)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div
                        className={s.el}
                        style={{ backgroundColor: "var(--bgBlack)" }}
                    >
                        <PerspectiveText label={text} />
                    </div>
                </motion.div>
            </button>
        </div>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={s.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}