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

/*
 * The pill grows leftward from its right edge. Expressed as a clip rather than a width: width is
 * a layout property, so animating it forced layout + paint every frame and the motion visibly
 * stuttered. A clip-path inset runs on the compositor, and unlike scaleX it leaves the image and
 * the arrow undistorted. 50 of 125px visible at rest = 60% clipped from the left.
 */
const expandAnim = {
  rest: {
    clipPath: "inset(0 0 0 60% round 25px)",
    transition: {
      duration: 0.3,
      ease: [0.76, 0, 0.24, 1] as Easing,
    },
  },
  hover: {
    clipPath: "inset(0 0 0 0% round 25px)",
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

  /* scaleX rather than width, for the same reason. The line is a plain bar, so scaling it is
     exactly equivalent visually and costs nothing per frame. */
  const lineAnim = {
    rest: {
      scaleX: 1,
    },
    hover: {
      scaleX: 1.5,
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
        style={styleObj}
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


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { transformOrigin: "right center" as const }
