"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Arrow from "@modules/common/icons/arrow"
import { Easing, motion } from "framer-motion"
import { useState } from "react"
import styles from "./styles.module.scss"

type LinkButtonProps = {
    text: string
    href: string
    className?: string
    index?: number
    onClickAction?: () => void
}

const lineAnim = {
    initial: {
        x: "-100%",
    },
    enter: {
        x: "0%",
        transition: {
            duration: 0.45,
            ease: [0.76, 0, 0.24, 1] as Easing
        }
        
    },
    exit: {
        x: "-100%",
        transition: {
            delay: 0.15,
            duration: 0.45,
            ease: [0.76, 0, 0.24, 1] as Easing
        }
        
    },
} as const

export default function LinkCat({ text, href, className, index, onClickAction } : LinkButtonProps) {
    const [isActive, setIsActive] = useState(false)

    return (
        <LocalizedClientLink
            href={href}
            className={`${styles.LinkCat} ${className ?? ""}`}
            data-link-index={index}
            onClick={onClickAction}
            onMouseEnter={() => setIsActive(true)}
            onMouseLeave={() => setIsActive(false)}
            onFocus={() => setIsActive(true)}
            onBlur={() => setIsActive(false)}
        >
            <span className={styles.textWindow}>
                <motion.span
                    className={styles.textTrack}
                    animate={{ y: isActive ? "-50%" : "0%" }}
                    transition={transition}
                >
                    <LinkFace label={text} />
                    <LinkFace label={text} />
                </motion.span>
            </span>
            <motion.span
                className={styles.Line}
                variants={lineAnim}
                initial="initial"
                animate={isActive ? "enter" : "exit"}
            >
            </motion.span>
        </LocalizedClientLink>
    )
}

function LinkFace({ label }: { label: string }) {
    return (
        <span className={styles.linkFace}>
            <span>{label}</span>
            <Arrow size={14} />
        </span>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.48, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
