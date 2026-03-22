"use client"

import { useState, useRef } from "react"
import { Button, toast } from "@medusajs/ui"
import { resendVerification } from "@lib/data/customer"
import { motion, useScroll, useTransform } from "framer-motion"
import styles from "./styles/send-email.module.scss"
import Image from "next/image"

type Props = {
  customer: {
    email: string
  }
}

export default function VerifyEmailReminderPage({ customer }: Props) {
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  })
  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "10%"])

  const handleResend = async () => {
      setLoading(true)
      setResent(false)
      const result = await resendVerification(customer.email)
      if (result.success) {
          toast.success(result.message)
          setResent(true)
      } else {
          toast.error(result.message)
      }
      setLoading(false)
  }

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.ImageContainer}>
          <motion.div
            className={styles.Image}
            style={{ y }}
          >
            <div className={styles.ImageOverlay} />
            <Image
              src={"/assets/img/img/2.jpg"}
              alt="Verification Email"
              layout="fill"
              objectFit="cover"
            />
          </motion.div>
      </div>
      <div className={styles.ImageContainer}>
          <motion.div
            className={styles.Image}
            style={{ y }}
          >
            <div className={styles.ImageOverlay} />
            <Image
              src={"/assets/img/img/1.jpg"}
              alt="Verification Email"
              layout="fill"
              objectFit="cover"
            />
          </motion.div>
      </div>
      <div className={styles.container}>
        <h1 className={styles.title}>Ověření e-mailu</h1>
        <p className={styles.desc}>
          Odeslali jsme ověřovací odkaz na <span>{customer.email}</span>.<br />
          Zkontrolujte svou doručenou poštu a klikněte na odkaz pro ověření své e-mailové adresy.
        </p>
        <p className={styles.subtle}>
          Nedostali jste e-mail? Zkontrolujte svou spamovou složku.<br />
          Ověřovací e-mail můžete také znovu odeslat níže.
        </p>
        <ClickButton
          onClickAction={handleResend}
          disabled={loading}
          text={loading ? "Odesílání..." : resent ? "E-mail byl odeslán!" : "Znovu odeslat ověřovací e-mail"}
        />
      </div>
    </section>
  )
}


type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
}

// This is base button for every button animation inside the website.
function ClickButton({ onClickAction, ClickAction, disabled = false, text }: ClickButtonProps) {
    const [isActive, setIsActive] = useState<boolean>(false);
    const handleClick = onClickAction ?? ClickAction;

    return (
        <div className={styles.ClickButton}>
            <button
                type="button"
                className={styles.button}
                onClick={handleClick}
                disabled={disabled}
                aria-busy={disabled || undefined}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
            >
                <motion.div
                    className={styles.slider}
                    animate={{ top: isActive ? "-100%" : "0%" }}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1] }}
                >
                    <div
                        className={styles.el}
                        style={{ backgroundColor: "var(--darkOlive)" }}
                    >
                        <PerspectiveText label={text} />
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