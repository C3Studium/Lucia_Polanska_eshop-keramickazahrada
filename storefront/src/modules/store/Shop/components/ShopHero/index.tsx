"use client"

import ArrowRight from "@modules/common/icons/arrow-right"
import { motion, useScroll, useSpring, useTransform } from "framer-motion"
import Image from "next/image"
import { useRef } from "react"
import styles from "./style.module.scss"

type ShopHeroProps = {
  productCount: number
  onExplore: () => void
}

const reveal = {
  hidden: { opacity: 0, y: 26 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.75, ease: [0.76, 0, 0.24, 1] as const },
  }),
}

/*
 * Lenis is configured with `lerp: 0.8` (LenisContext.tsx), which settles a wheel notch in about
 * four frames — close to raw deltas. Every other scroll-driven surface on the site springs its own
 * progress before using it; this hero was the one reading `scrollYProgress` straight, so the
 * parallax stepped with each notch.
 *
 * Tuned against a step: a 400px scroll discontinuity now spreads over roughly twenty frames and is
 * ~90% travelled by 400ms. Stiffer than the home page's stage springs on purpose — this hero has
 * only a viewport of travel, so a slower one reads as the image drifting loose from the page.
 */
const parallaxSpring = {
  stiffness: 200,
  damping: 34,
  mass: 0.3,
  restDelta: 0.0004,
}

export default function ShopHero({ productCount, onExplore }: ShopHeroProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const progress = useSpring(scrollYProgress, parallaxSpring)
  const imageY = useTransform(progress, [0, 1], ["0%", "14%"])
  const copyY = useTransform(progress, [0, 1], ["0%", "-8%"])

  return (
    <section
      ref={ref}
      className={styles.root}
      id="store-intro"
      data-scroll-section
      data-scroll-label="Úvod"
      aria-labelledby="shop-title"
    >
      <motion.div className={styles.image} style={{ y: imageY }}>
        <Image
          src="/assets/img/img/home_image.png"
          alt="Lucie Polanská při ruční tvorbě keramiky"
          fill
          priority
          quality={100}
          sizes="100vw"
        />
      </motion.div>
      <div className={styles.veil} />
      <motion.div className={styles.copy} style={{ y: copyY }}>
        <motion.p custom={0.05} variants={reveal} initial="hidden" animate="show" className={styles.eyebrow}>
          Keramická zahrada · Písek
        </motion.p>
        <motion.h1 id="shop-title" custom={0.12} variants={reveal} initial="hidden" animate="show">
          Keramika, která<br />vydrží roky.
        </motion.h1>
        <motion.p custom={0.2} variants={reveal} initial="hidden" animate="show" className={styles.intro}>
          Každý kus dělám rukama. Dva úplně stejné mi nevyjdou, ani kdybych chtěla.
        </motion.p>
        <motion.button custom={0.28} variants={reveal} initial="hidden" animate="show" type="button" onClick={onExplore}>
          Prohlédnout {productCount} kusů
          <ArrowRight size={18} color="#212222" />
        </motion.button>
      </motion.div>
      <div className={styles.facts} aria-label="Hodnoty kolekce">
        <span><small>01</small> Ruční výroba</span>
        <span><small>02</small> Vlastní návrhy</span>
        <span><small>03</small> Každý kus originál</span>
      </div>
      <span className={styles.scrollCue}>Objevovat <i /></span>
    </section>
  )
}
