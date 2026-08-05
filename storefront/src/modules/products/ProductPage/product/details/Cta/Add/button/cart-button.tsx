"use client";
import { motion } from 'framer-motion';

import styles from './cart-button.module.scss';

type ButtonProps = {
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    isLoading?: boolean;
    "data-testid"?: string;
    children: React.ReactNode;
}

export default function CartButton({
    onClick,
    disabled = false,
    className = "",
    isLoading = false,
    children,
    "data-testid": dataTestId,
}: ButtonProps) {
    const isDisabled = disabled || isLoading
    const fillVariants = {
        rest: { scaleX: 0 },
        hover: { scaleX: 1 },
    }

    return (
        <div className={`${styles.MButton} ${className}`}>
            <motion.button
                type="button"
                className={styles.button}
                onClick={onClick}
                disabled={isDisabled}
                data-testid={dataTestId}
                initial="rest"
                animate="rest"
                whileHover={isDisabled ? "rest" : "hover"}
                whileFocus={isDisabled ? "rest" : "hover"}
                whileTap={isDisabled ? undefined : { scale: 0.985 }}
            >
                <motion.span
                    className={styles.indicator}
                    variants={fillVariants}
                    style={styleObj}
                    transition={transition}
                />
                <span className={styles.label}>
                    {isLoading ? "Načítání..." : children}
                </span>
            </motion.button>
        </div>
    );
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { originX: 0 }
const transition = { duration: 0.48, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
