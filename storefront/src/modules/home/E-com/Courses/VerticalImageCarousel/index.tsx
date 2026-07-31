"use client"

import Image from "next/image"
import type { MotionValue } from "framer-motion"
import LiquidImageCarousel from "./LiquidImageCarousel"

export type VerticalCarouselImage = {
  id: number
  src: string
  alt: string
}

type VerticalImageCarouselProps = {
  images: VerticalCarouselImage[]
  scrollProgress: MotionValue<number>
}

export default function VerticalImageCarousel({
  images,
  scrollProgress,
}: VerticalImageCarouselProps) {
  const activeImage = images[0]

  if (!activeImage) {
    return null
  }

  return (
    <div className="CoursesCarousel">
      <div className="CoursesCarousel__base">
        <Image
          src={activeImage.src}
          alt={activeImage.alt}
          fill
          sizes="100vw"
          quality={85}
        />
      </div>

      <LiquidImageCarousel
        images={images}
        scrollProgress={scrollProgress}
        className="CoursesCarousel__liquidEther"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  )
}
