"use client"

import { Easing, motion } from "framer-motion"
import styles from "./styles.module.scss"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useState } from "react"
import ArrowRight from "@modules/common/icons/arrow-right"

type NavButton = {
  title?: string
  href?: string
  img?: string
  alt?: string
  icon1?: string | undefined
  icon2?: string | undefined
  Kind: "Link" | "Button"
  onClickAction?: () => void
  onTagAction?: (payload: { input: string; state: boolean }) => void
  className?: string
}

const expandAnim = {
  rest: {
    paddingRight: 5,
    paddingLeft: 5,
  },
  hover: {
    paddingRight: 10,
    paddingLeft: 10,
    transition: {
      duration: 0.35,
      ease: [0.76, 0, 0.24, 1] as Easing,
    },
  },
}

export default function WebButton({
  title,
  href,
  img = "/assets/links/home_img.png",
  alt = "bg__image",
  icon1,
  Kind,
  onClickAction,
  className,
}: NavButton) {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  const handleButtonClick = () => {
    onClickAction?.()
  }

  if (icon1) {
    return (
      <button className={styles.buttonIcon} type="button" onClick={handleButtonClick}>
        <motion.div className={styles.slider} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div className={styles.imgWrapper}>
            <PerspectiveImage img={img} alt={"bg__img"} />
          </div>
          <motion.div className={styles.el} style={{ perspective: 800 }}>
            <PerspectiveIcon icon1={icon1} alt={alt} />
          </motion.div>
        </motion.div>
      </button>
    )
  }

  const content = (
    <motion.div
      className={styles.slider}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      variants={expandAnim}
      initial="rest"
      animate={isHovered ? "hover" : "rest"}
    >
      <div className={styles.imgWrapper}>
        <PerspectiveImage img={img} alt={"bg__img"} />
      </div>
      <motion.div className={styles.el} style={{ perspective: 800 }}>
        <PerspectiveText label={title} active={isHovered} color="var(--whiteText)" />
      </motion.div>
    </motion.div>
  )

  if (Kind === "Link") {
    return (
      <LocalizedClientLink className={`${styles.button} ${className ?? ""}`} href={href ?? "/"}>
        {content}
      </LocalizedClientLink>
    )
  }

  return (
    <button className={`${styles.button} ${className ?? ""}`} onClick={handleButtonClick} type="button">
      {content}
    </button>
  )
}

function PerspectiveText({
  label,
  active,
  color,
}: {
  label?: string
  active: boolean
  color: string
}) {
  const iconScale = {
    rest: {
      width: 0,
      marginLeft: 0,
      opacity: 0,
      scale: 0.9,
    },
    hover: {
      width: 16,
      marginLeft: 6,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.35,
        ease: [0.76, 0, 0.24, 1] as Easing,
      },
    },
  }

  return (
    <div className={styles.perspectiveText} style={{ transformStyle: "preserve-3d" }}>
      <p style={{ color }}>
        {label}
        <motion.span className={styles.arrow} variants={iconScale} initial="rest" animate={active ? "hover" : "rest"}>
          <ArrowRight size={15} color="white" />
        </motion.span>
      </p>
    </div>
  )
}

function PerspectiveIcon({
  icon1,
  alt,
}: {
  icon1: string | undefined
  alt: string
}) {
  return (
    <div className={styles.PerspectiveIcon} style={{ transformStyle: "preserve-3d" }}>
      <div className={styles.image__wrapper}>
        <Image src={icon1 ?? "/assets/icons/logo.svg"} alt={alt} width={50} height={25} />
      </div>
    </div>
  )
}

function PerspectiveImage({ img, alt }: { img: string; alt: string }) {
  return (
    <div className={styles.perspectiveImage}>
      <div className={styles.img__wrapper}>
        <Image src={img} alt={alt} fill style={{ objectFit: "cover" }} />
        <div className={styles.overlay} />
      </div>
    </div>
  )
}
