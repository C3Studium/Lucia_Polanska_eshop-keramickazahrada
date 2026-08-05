import { AnimatePresence, Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import Image from 'next/image';
import { ChangeEvent, useEffect, useRef } from 'react';

type SearchButtonProps = {
  isActive?: boolean
  onClick?: () => void
  onValueChange?: (value: string) => void
  value?: string
}

const ease = [0.76, 0, 0.24, 1] as Easing

export default function SearchButton({
  isActive = false,
  onClick,
  onValueChange,
  value = "",
}: SearchButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isActive) return

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 250)
    return () => window.clearTimeout(focusTimer)
  }, [isActive])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange?.(event.currentTarget.value)
  }

  return (
    <motion.div
      className={`${styles.searchControl} ${isActive ? styles.active : ""}`}
      initial={false}
      animate={{ width: isActive ? 420 : 36 }}
      transition={transition}
      style={styleObj}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={isActive ? "Zavřít vyhledávání" : "Otevřít vyhledávání"}
        aria-expanded={isActive}
        aria-controls="navbar-search"
        onClick={onClick}
      >
        <Image className={styles.searchIcon} src="/assets/icons/search.svg" alt="" width={19} height={19}/>
      </button>
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.input
            ref={inputRef}
            className={styles.input}
            data-testid="navbar-search-input"
            type="search"
            value={value}
            placeholder="Vyhledat produkty…"
            aria-label="Vyhledat produkty"
            autoComplete="off"
            onChange={handleChange}
            initial={initial}
            animate={animate}
            exit={initial}
            transition={transition2}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.6, ease }
const styleObj = { transformOrigin: "left center" as const }
const initial = { opacity: 0, x: -14 }
const animate = { opacity: 1, x: 0 }
const transition2 = { duration: 0.25, delay: 0.12, ease }
