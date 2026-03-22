"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

import styles from "./styles.module.scss";

type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    active?: boolean; // New prop to keep button in active/animated state
    "data-testid"?: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
export default function ClickButton({ onClickAction, ClickAction, disabled = false, text, type = "button", className, active = false, "data-testid": dataTestId }: ClickButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    const { pending } = useFormStatus();
    const isSubmitting = type === "submit" ? pending : false;
    const isDisabled = disabled || isSubmitting;
    const handleClick = onClickAction ?? ClickAction;
    
    // Button stays in animated state if active prop is true, otherwise uses hover state
    const shouldAnimate = active || isActive;

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
                    animate={{top: shouldAnimate ? "-100%" : "0%"}}
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