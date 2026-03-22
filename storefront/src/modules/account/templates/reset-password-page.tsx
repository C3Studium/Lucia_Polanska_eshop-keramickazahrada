"use client"

import { sdk } from "@lib/config"
import { Toaster, toast } from "@medusajs/ui"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeSlash } from "@medusajs/icons"
import styles from "./styles/reset-password.module.scss"
import { useFormStatus } from "react-dom"
import { motion, useScroll, useTransform } from "framer-motion"
import Image from "next/image"

export default function ResetPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "10%"])

  const searchParams = useMemo(() => {
    if (typeof window === "undefined") {
      return
    }
    return new URLSearchParams(window.location.search)
  }, [])
  const token = useMemo(() => {
    return searchParams?.get("token")
  }, [searchParams])
    const email = useMemo(() => {
    const value = searchParams?.get("email") ?? ""
    return value
  }, [searchParams])

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    if (!token) {
      toast.error("Chybí token.")
      return
    }
    if (!password) {
      toast.error("Heslo je povinné pole.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Hesla se neshodují.")
      return
    }
    setLoading(true)

    sdk.auth.updateProvider("customer", "emailpass", {
      email,
      password,
    }, token)
    .then(() => {
      toast.success("Password reset successfully!")
      setSuccess(true)
    })
    .catch((error) => {
      toast.error(`Couldn't reset password: ${error.message}`)
    })
    .finally(() => {
      setLoading(false)
    })
  }

  // Auto-login handler
  const handleAutoLogin = async () => {
    if (!email || !password) return
    setLoginLoading(true)
    try {
      await sdk.auth.login("customer", "emailpass", {
        identifier: email,
        password,
      })
      toast.success("Přihlášení bylo úspěšné!")
      router.push("/account")
    } catch (error: any) {
      toast.error(error?.message || "Přihlášení se nezdařilo.")
    } finally {
      setLoginLoading(false)
    }
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
          src={"/assets/img/img/1.jpg"}
          alt="Reset Password"
          layout="fill"
          objectFit="cover"
        />
      </motion.div>
    </div>
    <div className={styles.formContainer}>
      <div className={styles.formHeader}>
        <h1>Resetovat heslo</h1>
        <p>Zadejte nové heslo pro svůj účet.</p>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label>Nové heslo</label>
        <div className={styles.inputWrap}>
          <input 
            placeholder="Heslo" 
            type={showPassword ? "text" : "password"}
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            disabled={success}
          />
          <button
            type="button"
            className={styles.toggle}
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <Eye /> : <EyeSlash />}
          </button>
        </div>
        <label>Potvrdit heslo</label>
        <div className={styles.inputWrap}>
          <input 
            placeholder="Potvrdit heslo" 
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={styles.input}
            disabled={success}
          />
          <button
            type="button"
            className={styles.toggle}
            tabIndex={-1}
            onClick={() => setShowConfirmPassword((v) => !v)}
          >
            {showConfirmPassword ? <Eye /> : <EyeSlash />}
          </button>
        </div>
        <ClickButton
          type="submit"
          disabled={loading || success}
          text="Resetovat heslo"
        />
        {success && (
          <div className={styles.successActions}>
            <ClickButton
              type="button"
              onClickAction={handleAutoLogin}
              disabled={loginLoading}
              text={loginLoading ? "Logging in..." : "Go to My Account"}
            />
          </div>
        )}
        <Toaster />
      </form>
    </div>
    
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