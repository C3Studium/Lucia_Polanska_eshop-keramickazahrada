"use client"

import { Easing, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type CarouselButtonProps = {
  src: string
  alt: string
  left: boolean
  onClick?: (speed: number) => void
}

const maxHoldSpeed = 1.65
const holdAccelerationDuration = 3000
const initialHoldDelay = 550
const holdStepDuration = 2600

const expandAnim = {
  rest: {
    width: 50,
  },
  hover: {
    width: 125,
    transition: {
      duration: 0.35,
      ease: [0.76, 0, 0.24, 1] as Easing,
    },
  },
}

export default function CarouselButton({
  src,
  alt,
  left,
  onClick,
}: CarouselButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdStartedAtRef = useRef(0)

  const stopHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
  }

  const getHoldSpeed = () => {
    const elapsed = performance.now() - holdStartedAtRef.current
    const progress = Math.min(elapsed / holdAccelerationDuration, 1)
    return 1 + (maxHoldSpeed - 1) * progress
  }

  const scheduleHoldStep = (delay: number) => {
    holdTimeoutRef.current = setTimeout(() => {
      const speed = getHoldSpeed()
      onClick?.(speed)
      scheduleHoldStep(holdStepDuration / speed)
    }, delay)
  }

  const startHold = () => {
    stopHold()
    holdStartedAtRef.current = performance.now()
    onClick?.(1)
    scheduleHoldStep(initialHoldDelay)
  }

  useEffect(() => stopHold, [])

  const arrowAnim = {
    rest: {
      x: 0,
      opacity: 0.85,
    },
    hover: {
      x: left ? -3 : 3,
      opacity: 1,
      transition: {
        duration: 0.35,
        ease: [0.76, 0, 0.24, 1] as Easing,
      },
    },
  }

  const lineAnim = {
    rest: {
      width: "100%",
    },
    hover: {
      width: "150%",
      transition: {
        duration: 0.35,
        ease: [0.76, 0, 0.24, 1] as Easing,
      },
    },
  }

  return (
    <motion.div
        className="Carousel__button__wrapper"
        variants={expandAnim}
        initial="rest"
        animate={isHovered ? "hover" : "rest"}
        style={{ transformOrigin: "right center" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
    >
        <motion.button
            className="Carousel__button"
            type="button"
            aria-label={alt}
            onClick={(event) => {
              if (event.detail === 0) {
                onClick?.(1)
              }
            }}
            onPointerDown={(event) => {
              if (event.button === 0) {
                startHold()
              }
            }}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onPointerLeave={stopHold}
        >
            <div className="image__bg">
                <div className="image__overlay"/>
                <Image src={src} alt="" fill sizes="64px" quality={60} />
            </div>
            <motion.span className="arrowCarousel" variants={arrowAnim} initial="rest" animate={isHovered ? "hover" : "rest"}>
                <span className={left ? "arrow__icon arrow__icon--left" : "arrow__icon"}>
                <div className="arrow__head arrow__head--top" />
                <motion.div
                    className="arrow__line"
                    variants={lineAnim}
                    initial="rest"
                    animate={isHovered ? "hover" : "rest"}
                    style={{ transformOrigin: left ? "right center" : "left center" }}
                />
                <div className="arrow__head arrow__head--bottom" />
                </span>
            </motion.span>
        </motion.button>
    </motion.div>
  )
}
