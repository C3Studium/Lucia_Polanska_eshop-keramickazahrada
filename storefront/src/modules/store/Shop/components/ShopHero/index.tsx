"use client"

import ArrowRight from "@modules/common/icons/arrow-right"
import { motion, useScroll, useTransform } from "framer-motion"
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

export default function ShopHero({ productCount, onExplore }: ShopHeroProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"])
  const copyY = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"])

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
          alt="Lucie Polanská při ruční tvorbě keramického objektu"
          fill
          priority
          quality={84}
          sizes="100vw"
        />
      </motion.div>
      <div className={styles.veil} />
      <motion.div className={styles.copy} style={{ y: copyY }}>
        <motion.p custom={0.05} variants={reveal} initial="hidden" animate="show" className={styles.eyebrow}>
          Keramická zahrada · kolekce 2026
        </motion.p>
        <motion.h1 id="shop-title" custom={0.12} variants={reveal} initial="hidden" animate="show">
          Objekty pro<br />každodenní rituály.
        </motion.h1>
        <motion.p custom={0.2} variants={reveal} initial="hidden" animate="show" className={styles.intro}>
          Každý kus vzniká pomalu, rukama a bez snahy zopakovat tentýž tvar podruhé.
        </motion.p>
        <motion.button custom={0.28} variants={reveal} initial="hidden" animate="show" type="button" onClick={onExplore}>
          Prohlédnout {productCount} originálů
          <ArrowRight size={18} color="#212222" />
        </motion.button>
      </motion.div>
      <div className={styles.facts} aria-label="Hodnoty kolekce">
        <span><small>01</small> Ruční výroba</span>
        <span><small>02</small> Autorský design</span>
        <span><small>03</small> Každý kus originál</span>
      </div>
      <span className={styles.scrollCue}>Objevovat <i /></span>
    </section>
  )
}
