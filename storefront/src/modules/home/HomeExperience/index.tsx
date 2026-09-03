"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { PropsWithChildren, useRef } from "react"
import styles from "./styles.module.scss"
import { palette } from "styles/palette.generated"

export default function HomeExperience({ children }: PropsWithChildren) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  })

  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.13, 0.25, 0.7, 0.9, 1],
    [palette.black03, palette.sage01, palette.gradientHome1, palette.ambientShowcase1, palette.sage01, palette.black03]
  )
  const glowOpacity = useTransform(
    scrollYProgress,
    [0.08, 0.24, 0.7, 0.93],
    [0, 0.52, 0.24, 0]
  )
  const glowY = useTransform(scrollYProgress, [0, 1], ["8%", "72%"])

  return (
    <motion.main
      ref={wrapperRef}
      className={styles.experience}
      style={{ backgroundColor }}
    >
      <motion.div
        aria-hidden="true"
        className={styles.glazeLight}
        style={{ opacity: glowOpacity, y: glowY }}
      />
      <div className={styles.content}>{children}</div>
    </motion.main>
  )
}
