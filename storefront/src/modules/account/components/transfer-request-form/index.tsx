"use client"

import { useActionState } from "react"
import { createTransferRequest } from "@lib/data/orders"
import { Input, IconButton } from "@medusajs/ui"
import { CheckCircleMiniSolid, XCircleSolid } from "@medusajs/icons"
import { useEffect, useState } from "react"
import s from "./style.module.scss"
import { useFormStatus } from "react-dom"
import { motion } from 'framer-motion';

export default function TransferRequestForm() {
  const [showSuccess, setShowSuccess] = useState(false)

  const [state, formAction] = useActionState(createTransferRequest, {
    success: false,
    error: null,
    order: null,
  })

  useEffect(() => {
    if (state.success && state.order) {
      setShowSuccess(true)
    }
  }, [state.success, state.order])

  return (
    <div className={s.root}>
      <div className={s.headerRow}>
        <div className={s.intro}>
          <h3 className={s.title}>Převod objednávek</h3>
          <p className={s.desc}>
            Nemůžete najít objednávku, kterou hledáte?
            <br /> Propojte objednávku se svým účtem.
          </p>
        </div>
        <form action={formAction} className={s.form}>
          <div className={s.formInner}>
            <Input className={s.input} name="order_id" placeholder="ID objednávky" />
            <ClickButton 
              text="Požádat o převod"
              type="submit"
              className={`${s.transferBtn} w-fit whitespace-nowrap self-end`}
            />
          </div>
        </form>
      </div>
      <div className={s.messages}>
        {!state.success && state.error && (
          <p className={s.error}>{state.error}</p>
        )}
        {showSuccess && (
          <div className={s.success}>
            <div className={s.successLeft}>
              <CheckCircleMiniSolid className={s.iconSuccess} />
              <div className={s.successTextWrap}>
                <p className={s.successTitle}>
                  Požadavek na převod pro objednávku {state.order?.id} byl odeslán
                </p>
                <p className={s.successDesc}>
                  E-mail s žádostí o převod byl odeslán na {state.order?.email}
                </p>
              </div>
            </div>
            <IconButton variant="transparent" className={s.closeBtn} onClick={() => setShowSuccess(false)}>
              <XCircleSolid className={s.iconClose} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  )
}



function PerspectiveText({label, className, textColor, component}: {label: string; className?: string; textColor?: string, component?: React.ReactNode}) {
  return (    
    <div className={s.perspectiveText}>
        <p 
          className={className}
          style={{
            color: textColor,
          }}
        >
          {label}
          {component}
        </p>
        <p 
          className={className}
          style={{
            color: textColor,
          }}
        >
          {label}
          {component}
        </p>
    </div>
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
