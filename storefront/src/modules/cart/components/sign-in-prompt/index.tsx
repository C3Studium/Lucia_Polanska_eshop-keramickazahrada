"use client";
// import { Button } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import s from "./style.module.scss"


import { motion } from 'framer-motion';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

const SignInPrompt = () => {
  return (
    <div className={s.root}>
      <div className={s.content}>
        <h2 className={s.title}>Máte již účet?</h2>
        <p className={s.desc}>Přihlaste se pro lepší zážitek.</p>
      </div>
      <div className={s.ctaWrap}>
        <LocalizedClientLink className={s.link} href="/account">
            <ClickButton
                text="Přihlásit se"
                type="button"
                className={s.button}
                data-testid="sign-in-button"
                onClickAction={undefined} // navigation handled by Link
            />
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt


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
                        style={{ backgroundColor: "var(--bgPrimary)" }}
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