"use client"

import { Easing, motion } from "framer-motion"
import Image from "next/image"
import { CSSProperties, useEffect, useRef, useState } from "react"

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
 * All of the button's geometry lives here and is handed to the stylesheet as custom properties.
 * It used to be split three ways — 125px in the SCSS, 60% in the clip, `width: 100%` on the
 * shaft — and the three had drifted apart: the shaft was 101px inside a 50px window so it ran off
 * both edges, and the left button anchored its head to the far side of the hidden strip, which
 * meant it had no visible arrowhead at all.
 */
const BUTTON_SIZE = 50 // the circle you actually see at rest
const BUTTON_REACH = 75 // the strip the pill opens into on hover
const ARROW_INSET = 13 // arrow tip, measured in from the right edge of that circle
const ARROW_REST = 20 // shaft length at rest, centred in the circle
const ARROW_HOVER = 62 // shaft length once the pill is open

const ease = [0.76, 0, 0.24, 1] as Easing

/*
 * The pill grows leftward from its right edge. Expressed as a clip rather than a width: width is
 * a layout property, so animating it forced layout + paint every frame and the motion visibly
 * stuttered. A clip-path inset runs on the compositor, and unlike scaleX it leaves the image and
 * the arrow undistorted.
 */
const expandAnim = {
  rest: {
    clipPath: `inset(0 0 0 ${BUTTON_REACH}px round ${BUTTON_SIZE / 2}px)`,
    transition: {
      duration: 0.3,
      ease,
    },
  },
  hover: {
    clipPath: `inset(0 0 0 0px round ${BUTTON_SIZE / 2}px)`,
    transition: {
      duration: 0.35,
      ease,
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
        ease,
      },
    },
  }

  /* scaleX rather than width, for the same reason as the clip above. The shaft is a plain bar, so
     scaling it is exactly equivalent visually and costs nothing per frame. It grows leftward, out
     of the circle and into the strip the pill has just revealed. */
  const lineAnim = {
    rest: {
      scaleX: 1,
    },
    hover: {
      scaleX: ARROW_HOVER / ARROW_REST,
      transition: {
        duration: 0.35,
        ease,
      },
    },
  }

  /* The head sits on the shaft's leading end. Pointing right that end is pinned; pointing left it
     is the end the shaft grows from, so the head travels the extra length with it. */
  const tipAnim = {
    rest: {
      x: 0,
    },
    hover: {
      x: left ? -(ARROW_HOVER - ARROW_REST) : 0,
      transition: {
        duration: 0.35,
        ease,
      },
    },
  }

  return (
    <motion.div
        className="Carousel__button__wrapper"
        variants={expandAnim}
        initial="rest"
        animate={isHovered ? "hover" : "rest"}
        style={wrapperStyle}
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
                <Image src={src} alt="" fill sizes="125px" quality={60} />
            </div>
            <motion.span className="arrowCarousel" variants={arrowAnim} initial="rest" animate={isHovered ? "hover" : "rest"}>
                <span className={left ? "arrow__icon arrow__icon--left" : "arrow__icon"}>
                <motion.span
                    className="arrow__line"
                    variants={lineAnim}
                    initial="rest"
                    animate={isHovered ? "hover" : "rest"}
                />
                <motion.span
                    className="arrow__tip"
                    variants={tipAnim}
                    initial="rest"
                    animate={isHovered ? "hover" : "rest"}
                >
                    <span className="arrow__head arrow__head--top" />
                    <span className="arrow__head arrow__head--bottom" />
                </motion.span>
                </span>
            </motion.span>
        </motion.button>
    </motion.div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const wrapperStyle = {
  transformOrigin: "right center",
  "--carousel-btn-size": `${BUTTON_SIZE}px`,
  "--carousel-btn-reach": `${BUTTON_REACH}px`,
  "--arrow-inset": `${ARROW_INSET}px`,
  "--arrow-rest": `${ARROW_REST}px`,
} as CSSProperties
