"use client"

import Image from "next/image"
import {
  animate,
  motion,
  type Easing,
  type MotionValue,
  useMotionValue,
  useTransform,
} from "framer-motion"
import { useEffect, useRef, useState } from "react"

const rotationEase = [0.45, 0, 0.55, 1] as Easing
const movementRatio = 0.5
const revealLeadRatio = 0.06
const revealSpeedBoost = 1.15
const maxNavigationSpeed = 1.65

const rangeMap = (
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
) => {
  const progress = (value - inputMin) / (inputMax - inputMin)
  return outputMin + progress * (outputMax - outputMin)
}

const deterministicRandom = (seed: number) => {
  const value = Math.sin(seed * 999.91) * 10000
  return value - Math.floor(value)
}

const normalizeAngle = (angle: number) => {
  return ((angle + 180) % 360 + 360) % 360 - 180
}

export type CarouselImage = {
  id: number
  src: string
  alt: string
}

export type CarouselNavigation = {
  id: number
  delta: -1 | 1
  speed: number
}

type ImageCarouselProps = {
  images: CarouselImage[]
  direction: "left-to-right" | "right-to-left"
  delay?: number
  interval?: number
  navigation?: CarouselNavigation | null
}

type CircularSlideProps = {
  image: CarouselImage
  index: number
  imageCount: number
  radius: number
  angleStep: number
  direction: ImageCarouselProps["direction"]
  directionBlend: MotionValue<number>
  revealPosition: MotionValue<number>
  rotation: MotionValue<number>
  travelDelta: -1 | 1
}

type DirectionalClipPathProps = {
  image: CarouselImage
  index: number
  imageCount: number
  direction: ImageCarouselProps["direction"]
  revealPosition: MotionValue<number>
  travelDelta: -1 | 1
}

function DirectionalClipPath({
  image,
  index,
  imageCount,
  direction,
  revealPosition,
  travelDelta,
}: DirectionalClipPathProps) {
  const movesLeftToRight = direction === "left-to-right"
    ? travelDelta === 1
    : travelDelta === -1

  const clipPath = useTransform(revealPosition, (currentPosition) => {
    if (imageCount < 2) {
      return "inset(0 0% 0 0% round 15px)"
    }

    const rawDistance = index - currentPosition
    const wrappedDistance = (
      (rawDistance + imageCount / 2) % imageCount + imageCount
    ) % imageCount - imageCount / 2
    const directionalDistance = wrappedDistance * travelDelta
    const visibleProgress = Math.max(0, 1 - Math.abs(directionalDistance))
    const hiddenEdge = (1 - visibleProgress) * 100
    const isIncoming = directionalDistance >= 0

    if (movesLeftToRight) {
      return isIncoming
        ? `inset(0 ${hiddenEdge}% 0 0 round 15px)`
        : `inset(0 0 0 ${hiddenEdge}% round 15px)`
    }

    return isIncoming
      ? `inset(0 0 0 ${hiddenEdge}% round 15px)`
      : `inset(0 ${hiddenEdge}% 0 0 round 15px)`
  })

  return (
    <motion.div className="ImageCarousel__clip" style={{ clipPath }}>
      <div className="ImageCarousel__media">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          quality={85}
        />
      </div>
    </motion.div>
  )
}

function CircularSlide({
  image,
  index,
  imageCount,
  radius,
  angleStep,
  direction,
  directionBlend,
  revealPosition,
  rotation,
  travelDelta,
}: CircularSlideProps) {
  const baseDirection = direction === "left-to-right" ? -1 : 1
  const baseAngle = baseDirection * index * angleStep
  const layoutDirection = direction === "left-to-right" ? 1 : -1
  const skewXFactor = rangeMap(deterministicRandom(index + 1.17), 0, 1, 0.95, 1.05)
  const skewYFactor = rangeMap(deterministicRandom(index + 2.41), 0, 1, 0.95, 1.05)
  const depthFactor = rangeMap(deterministicRandom(index + 4.73), 0, 1, 0.95, 1.05)
  const rotateZFactor = rangeMap(deterministicRandom(index + 7.29), 0, 1, 0.95, 1.05)

  const skewXAmplitude = 5.5 * skewXFactor
  const skewYAmplitude = 2 * skewYFactor
  const depthAmplitude = -40 * depthFactor
  const scaleAmplitude = -0.04 * depthFactor
  const rotateZAmplitude = 1.25 * rotateZFactor

  const getDeformation = (currentRotation: number) => {
    if (angleStep === 0) {
      return 0
    }

    const currentAngle = normalizeAngle(baseAngle + currentRotation)
    const distanceFromKeyframe = Math.min(Math.abs(currentAngle) / angleStep, 1)

    return Math.sin(distanceFromKeyframe * Math.PI * 0.5)
  }

  const x = useTransform(rotation, (currentRotation) => {
    const angle = (baseAngle + currentRotation) * (Math.PI / 180)
    return Math.sin(angle) * radius
  })

  const y = useTransform(rotation, (currentRotation) => {
    const angle = (baseAngle + currentRotation) * (Math.PI / 180)
    return (1 - Math.cos(angle)) * radius
  })

  const skewX = useTransform(
    [rotation, directionBlend],
    (latestValues) => {
      const [currentRotation, currentDirection] = latestValues as number[]
      return layoutDirection
        * currentDirection
        * skewXAmplitude
        * getDeformation(currentRotation)
    }
  )

  const skewY = useTransform(
    [rotation, directionBlend],
    (latestValues) => {
      const [currentRotation, currentDirection] = latestValues as number[]
      return layoutDirection
        * currentDirection
        * skewYAmplitude
        * getDeformation(currentRotation)
    }
  )

  const z = useTransform(rotation, (currentRotation) => {
    return depthAmplitude * getDeformation(currentRotation)
  })

  const scale = useTransform(rotation, (currentRotation) => {
    return 1 + scaleAmplitude * getDeformation(currentRotation)
  })

  const rotateZ = useTransform(
    [rotation, directionBlend],
    (latestValues) => {
      const [currentRotation, currentDirection] = latestValues as number[]
      return layoutDirection
        * currentDirection
        * rotateZAmplitude
        * getDeformation(currentRotation)
    }
  )

  const zIndex = useTransform(
    [rotation, directionBlend],
    (latestValues) => {
      const [currentRotation, currentDirection] = latestValues as number[]
      const angle = (baseAngle + currentRotation) * (Math.PI / 180)
      const directionMultiplier = layoutDirection * currentDirection
      const incomingLayerBias = -Math.sin(angle) * directionMultiplier * 8
      return Math.round((Math.cos(angle) + 1) * 50 + incomingLayerBias)
    }
  )

  return (
    <motion.div
      className="ImageCarousel__slide"
      style={{
        x,
        y,
        z,
        zIndex,
        scale,
        skewX,
        skewY,
        rotateZ,
        transformPerspective: 1200,
      }}
    >
      <DirectionalClipPath
        image={image}
        index={index}
        imageCount={imageCount}
        direction={direction}
        revealPosition={revealPosition}
        travelDelta={travelDelta}
      />
    </motion.div>
  )
}

export default function ImageCarousel({
  images,
  direction,
  delay = 0,
  interval = 5200,
  navigation,
}: ImageCarouselProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef<(
    (delta: -1 | 1, speed?: number) => void
  ) | null>(null)
  const handledNavigationRef = useRef<number | null>(null)
  const targetStepRef = useRef(0)
  const retainedDirectionRef = useRef<-1 | 1>(1)
  const isAnimatingRef = useRef(false)
  const [imageWidth, setImageWidth] = useState(0)
  const [travelDelta, setTravelDelta] = useState<-1 | 1>(1)
  const directionBlend = useMotionValue(1)
  const revealPosition = useMotionValue(0)
  const rotation = useMotionValue(0)

  const angleStep = images.length > 0 ? 360 / images.length : 0
  const imageMargin = imageWidth * -0.75
  const circumference = images.length * (imageWidth + imageMargin)
  const radius = circumference / (2 * Math.PI)
  const rotationDirection = direction === "left-to-right" ? 1 : -1
  const movementDuration = (interval / 1000) * movementRatio
  const revealLeadDuration = (interval / 1000) * revealLeadRatio
  const holdDuration = Math.max(
    0,
    interval - (movementDuration + revealLeadDuration) * 1000
  )

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) {
      return
    }

    const updateWidth = () => setImageWidth(wrapper.getBoundingClientRect().width)
    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(wrapper)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    targetStepRef.current = 0
    retainedDirectionRef.current = 1
    isAnimatingRef.current = false
    directionBlend.set(1)
    revealPosition.set(0)
    rotation.set(0)

    if (images.length < 2) {
      return
    }

    let isDisposed = false
    let sequenceId = 0
    let autoTimeout: ReturnType<typeof setTimeout> | undefined
    let stopDirectionBlend: (() => void) | undefined
    let stopReveal: (() => void) | undefined
    let stopRotation: (() => void) | undefined

    const move = (delta: -1 | 1, speed = 1) => {
      sequenceId += 1
      const currentSequence = sequenceId

      if (autoTimeout) {
        clearTimeout(autoTimeout)
        autoTimeout = undefined
      }

      stopReveal?.()
      stopRotation?.()
      stopDirectionBlend?.()

      const wasAnimating = isAnimatingRef.current
      const directionChanged = retainedDirectionRef.current !== delta
      retainedDirectionRef.current = delta
      targetStepRef.current += delta
      isAnimatingRef.current = true
      setTravelDelta(delta)

      const currentStep = rotation.get() / (rotationDirection * angleStep)
      const targetStep = targetStepRef.current
      const targetDistance = Math.abs(targetStep - currentStep)
      const cappedSpeed = Math.min(Math.max(speed, 1), maxNavigationSpeed)
      const animationDuration = Math.max(
        0.35,
        movementDuration * targetDistance / cappedSpeed
      )
      const rotationDelay = wasAnimating ? 0 : revealLeadDuration
      const targetRotation = rotationDirection * targetStep * angleStep

      const directionAnimation = animate(directionBlend, delta, {
        duration: directionChanged
          ? animationDuration + rotationDelay
          : Math.min(0.35, animationDuration),
        ease: rotationEase,
        type: "tween",
      })
      const revealAnimation = animate(revealPosition, targetStep, {
        duration: animationDuration / revealSpeedBoost,
        ease: rotationEase,
        type: "tween",
      })
      const rotationAnimation = animate(rotation, targetRotation, {
        delay: rotationDelay,
        duration: animationDuration,
        ease: rotationEase,
        type: "tween",
      })

      stopDirectionBlend = () => directionAnimation.stop()
      stopReveal = () => revealAnimation.stop()
      stopRotation = () => rotationAnimation.stop()

      rotationAnimation.then(() => {
        if (isDisposed || currentSequence !== sequenceId) {
          return
        }

        isAnimatingRef.current = false
        directionBlend.set(delta)
        revealPosition.set(targetStep)
        rotation.set(targetRotation)
        autoTimeout = setTimeout(
          () => move(retainedDirectionRef.current, 1),
          holdDuration
        )
      })
    }

    moveRef.current = move
    autoTimeout = setTimeout(() => move(1, 1), interval + delay * 1000)

    return () => {
      isDisposed = true
      sequenceId += 1
      isAnimatingRef.current = false
      moveRef.current = null
      stopDirectionBlend?.()
      stopReveal?.()
      stopRotation?.()
      if (autoTimeout) {
        clearTimeout(autoTimeout)
      }
    }
  }, [
    angleStep,
    delay,
    directionBlend,
    holdDuration,
    images.length,
    interval,
    movementDuration,
    revealLeadDuration,
    revealPosition,
    rotation,
    rotationDirection,
  ])

  useEffect(() => {
    if (!navigation || handledNavigationRef.current === navigation.id) {
      return
    }

    handledNavigationRef.current = navigation.id
    moveRef.current?.(navigation.delta, navigation.speed)
  }, [navigation])

  if (images.length === 0) {
    return null
  }

  return (
    <div ref={wrapperRef} className="ImageCarousel">
      {images.map((image, index) => (
        <CircularSlide
          key={image.id}
          image={image}
          index={index}
          imageCount={images.length}
          radius={radius}
          angleStep={angleStep}
          direction={direction}
          directionBlend={directionBlend}
          revealPosition={revealPosition}
          rotation={rotation}
          travelDelta={travelDelta}
        />
      ))}
    </div>
  )
}
