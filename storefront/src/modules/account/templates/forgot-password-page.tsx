"use client"

import { sdk } from "@lib/config"
import { Toaster, toast } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

import styles from "./styles/forgot-password.module.scss"
import Image from "next/image"
import { useFormStatus } from "react-dom"

export default function RequestResetPassword() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "10%"])

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    if (!email) {
      toast.error("Email je povinné pole.")
      return
    }
    setLoading(true)

    sdk.auth.resetPassword("customer", "emailpass", {
      identifier: email,
    })
    .then(() => {
      toast.success("Pokud existuje účet s tímto e-mailem, obdržíte instrukce k obnovení hesla.")
    })
    .catch((error) => {
      toast.error(error.message)
    })
    .finally(() => {
      setLoading(false)
    })
  }

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.ImageContainer}>
        <motion.div
          className={styles.Image}
          style={{ y }}
        >
          <div className={styles.ImageOverlay}/>
          <Image 
            src="/assets/img/img/1.jpg"
            alt="Description of image"
            layout="fill"
            objectFit="cover"
          />
        </motion.div>
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Resetovat Heslo</h1>
          <div className={styles.intro}>
            <p>
              Zadejte svou e-mailovou adresu níže a obdržíte odkaz pro obnovení hesla.
            </p>
            <p>
              Pokud e-mail neobdržíte, zkontrolujte prosím svou spamovou složku.
            </p>
            <p>
              Pokud nemáte účet, prosím{" "}
              <LocalizedClientLink href="/register" className="underline">
                zaregistrujte se
              </LocalizedClientLink>.
            </p>
            <p>
              Pokud si pamatujete své heslo, můžete se{" "}
              <LocalizedClientLink href="/login" className="underline">
                přihlásit
              </LocalizedClientLink>.
            </p>
          </div>
      </div>
      <div className={styles.formWrap}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label>Email</label>
            <input 
              placeholder="Email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
            <ClickButton
              type="submit"
              disabled={loading}
              text={loading ? "Odesílání..." : "Odeslat odkaz pro obnovení hesla"}
            />
          </form>
      </div>
     </div>
     <Toaster />
    </section>
  )
}


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
    <div className={className ? `${styles.ClickButton} ${className}` : styles.ClickButton}>
            <button
                type={type}
        className={styles.button}
                onClick={handleClick}
                disabled={isDisabled}
                aria-busy={isDisabled || undefined}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                data-testid={dataTestId}
            >
                <motion.div
          className={styles.slider}
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div
            className={styles.el}
                        style={{ backgroundColor: "var(--darkOlive)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div
            className={styles.el}
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
    <div className={styles.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}