"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Toaster, toast } from "@medusajs/ui"
import { verifyCustomerEmail, resendVerification, retrieveCustomer } from "@lib/data/customer"
import styles from "./styles/verify-email.module.scss"
import { motion, useScroll, useTransform } from "framer-motion"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const searchParams = useSearchParams()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "10%"])

  const token = searchParams.get("token") || ""
  const email = searchParams.get("email") || ""

  const handleVerify = async () => {
    setLoading(true)
    try {
      const result = await verifyCustomerEmail(token, email)
      if (result.ok) {
        toast.success(result.message || "Potvrzení e-mailu bylo úspěšné!")
        setSuccess(true)
        // fetch fresh customer so UI reflects updated metadata
        try {
          await retrieveCustomer({ forceFresh: true })
        } catch (e) {
          // non-fatal
          console.warn("verify-email: failed to refresh customer", e)
        }
      } else {
        toast.error(result.message || "Ověření selhalo.")
      }
    } catch (e) {
      toast.error("Ověření selhalo.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error("Chybí e-mail pro opětovné odeslání.")
      return
    }
    setResending(true)
    setResent(false)
    try {
      const result = await resendVerification(email)
      if (result.success) {
        toast.success(result.message)
        setResent(true)
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se odeslat ověřovací e-mail.")
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    handleVerify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            alt="Potvrzení e-mailové adresy"
            layout="fill"
            objectFit="cover"
          />
        </motion.div>
      </div>
      <div className={styles.container}>
        <h1 className={styles.title}>Potvrzení e-mailové adresy</h1>
        <p className={styles.desc}>
          { loading ? "Klikněte na tlačítko níže pro potvrzení vaší e-mailové adresy." : success ? "Potvrzení e-mailu bylo úspěšné!" : "Ověření selhalo."}
        </p>
        <ClickButton 
          disabled={loading || success} 
          onClickAction={handleVerify}
          text={loading ? "Ověřuji..." : success ? "Ověřeno!" : "Potvrdit e-mail"}
        />
        {!success && (
          <div className={styles.actions}>
            <ClickButton
              disabled={resending}
              onClickAction={handleResend}
              text={resending ? "Odesílání..." : resent ? "E-mail byl odeslán!" : "Znovu odeslat ověřovací e-mail"}
            />
          </div>
        )}
        {success && (
          <div className={styles.actions}>
            <LinkButton text="Přejít na můj účet" href="/account" />
            <LinkButton text="Přejít do obchodu" href="/" />
          </div>
        )}
        <Toaster />
      </div>
    </section>
  )
}

type LinkButtonProps = {
    text: string;
    href: string; 
}

// This is base button for every button animation inside the website.

function LinkButton({ text, href } : LinkButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    return (
        <LocalizedClientLink href={href} className={styles.LinkButtonS}>
            <button 
                className={styles.button}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
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
                        style={{ backgroundColor: "var(--bgPrimary)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                </motion.div>
            </button>
        </LocalizedClientLink>
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
