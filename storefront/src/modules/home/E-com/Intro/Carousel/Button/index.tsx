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
 * Rest = the 50px circle, hover = 250 % of it (Matěj, 2026-08-13). The width
 * really animates — the previous clip-path trick kept the box at full size and
 * cut a window out of it, which sliced the pink border and the image with it:
 * that was the "broken ring" look. Growing the box instead means the border
 * always wraps the whole pill and the cover image just re-crops, so nothing
 * shrinks and nothing is clipped mid-animation.
 *
 * The row holding both buttons is right-anchored with a reserved width
 * (Carousel/style.scss), so a growing button extends leftward — the left one
 * opens into free space, the right one pushes its neighbour aside.
 */
const BUTTON_SIZE = 50
const BUTTON_GROWN = BUTTON_SIZE * 2.5
const LINE_REST = 20
const LINE_HOVER = 84

const ease = [0.76, 0, 0.24, 1] as Easing
const grow = { duration: 0.4, ease }

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

  return (
    <motion.button
      className={`Carousel__button ${left ? "Carousel__button--left" : ""}`}
      type="button"
      aria-label={alt}
      initial={false}
      animate={{ width: isHovered ? BUTTON_GROWN : BUTTON_SIZE }}
      transition={grow}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        <div className="image__overlay" />
        <Image src={src} alt="" fill sizes="125px" quality={60} />
      </div>
      {/*
       * The arrow is a flex row anchored to the pill's still end — [chevron,
       * line] for the left button, [line, chevron] for the right. Only the
       * line's width animates; being in normal flow it shoulders the chevron
       * outward as it grows, which is the whole "the line pushes the head"
       * behaviour with no coordinate math to drift.
       */}
      <span className="arrow__icon" aria-hidden>
        <motion.span
          className="arrow__line"
          initial={false}
          animate={{ width: isHovered ? LINE_HOVER : LINE_REST }}
          transition={grow}
        />
        <span className="arrow__tip">
          <span className="arrow__head arrow__head--top" />
          <span className="arrow__head arrow__head--bottom" />
        </span>
      </span>
    </motion.button>
  )
}
