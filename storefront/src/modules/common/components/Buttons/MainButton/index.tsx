"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import LocalizedClientLink from '../../localized-client-link';

type ClickButtonProps = {
    kind?: "Link" | "Submit" | "Product" | "Tag"
    type: "button" | "submit" | "reset";
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
    className?: string;
    "data-testid"?: string;
    active?: boolean;
    href?: string | undefined;

}

// Base animated button used across the site. Can act as a submit button in forms.
export default function MainButton({ onClickAction, ClickAction, disabled = false, text, kind = "Link", type = "button", className, "data-testid": dataTestId, href }: ClickButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    const { pending } = useFormStatus();
    const isSubmitting = type === "submit" ? pending : false;
    const isDisabled = disabled || isSubmitting;
    const handleClick = onClickAction ?? ClickAction;


    if (kind === "Product") {
        return (
            <div className={className ? `MainButton ${className}` : "MainButton"}>
                <button 
                    type={type}
                    className="button"
                    onClick={handleClick}
                    disabled={isDisabled}
                    aria-busy={isDisabled || undefined}
                    onMouseEnter={() => setIsActive(true)}
                    onMouseLeave={() => setIsActive(false)}
                    data-testid={dataTestId}
                >
                    <motion.div 
                        className="slider"
                        animate={{top: isActive ? "-100%" : "0%"}}
                        transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                    >
                        <div 
                            className="el"
                            style={{ backgroundColor: "var(--OButton)" }}
                        >
                            <PerspectiveText label={text}/>
                        </div>
                        <div 
                            className="el"
                            style={{ backgroundColor: "var(--CharcoalBg)" }}
                        >
                            <PerspectiveText label={text} />
                        </div>
                    </motion.div>
                </button>
            </div>
        )
    };
    if (kind === "Submit") {
        return (
            <div className={className ? `MainButton ${className}` : "MainButton"}>
                <button 
                    type={type}
                    className="button"
                    onClick={handleClick}
                    disabled={isDisabled}
                    aria-busy={isDisabled || undefined}
                    onMouseEnter={() => setIsActive(true)}
                    onMouseLeave={() => setIsActive(false)}
                    data-testid={dataTestId}
                >
                    <motion.div 
                        className="slider"
                        animate={{top: isActive ? "-100%" : "0%"}}
                        transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                    >
                        <div 
                            className="el"
                            style={{ backgroundColor: "var(--OButton)" }}
                        >
                            <PerspectiveText label={text}/>
                        </div>
                        <div 
                            className="el"
                            style={{ backgroundColor: "var(--CharcoalBg)" }}
                        >
                            <PerspectiveText label={text} />
                        </div>
                    </motion.div>
                </button>
            </div>
        )
    }
    if (kind === "Tag") {
        return (
            <div className={className ? `MainButton ${className}` : "MainButton"}>
                <button 
                    type={type}
                    className="button"
                    onClick={handleClick}
                    disabled={isDisabled}
                    aria-busy={isDisabled || undefined}
                    onMouseEnter={() => setIsActive(true)}
                    onMouseLeave={() => setIsActive(false)}
                    data-testid={dataTestId}
                >
                    <motion.div 
                        className="slider"
                        animate={{top: isActive ? "-100%" : "0%"}}
                        transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                    >
                        <div 
                            className="el"
                            style={{ backgroundColor: "var(--OButton)" }}
                        >
                            <PerspectiveText label={text}/>
                        </div>
                        <div 
                            className="el"
                            style={{ backgroundColor: "var(--CharcoalBg)" }}
                        >
                            <PerspectiveText label={text} />
                        </div>
                    </motion.div>
                </button>
            </div>
        )
    }
    return (
        <div className={className ? `MainButton ${className}` : "MainButton"}>
            <LocalizedClientLink 
                href={href}
                type={type}
                className="button"
                onClick={handleClick}
                disabled={isDisabled}
                aria-busy={isDisabled || undefined}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                data-testid={dataTestId}
            >
                <motion.div 
                    className="slider"
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div 
                        className="el"
                        style={{ backgroundColor: "var(--OButton)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className="el"
                        style={{ backgroundColor: "var(--CharcoalBg)" }}
                    >
                        <PerspectiveText label={text} />
                    </div>
                </motion.div>
            </LocalizedClientLink>
        </div>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className="perspectiveText">
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}