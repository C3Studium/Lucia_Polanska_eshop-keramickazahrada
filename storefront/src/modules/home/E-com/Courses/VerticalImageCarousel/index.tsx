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
          quality={100}
        />
      </div>

      <LiquidImageCarousel
        images={images}
        scrollProgress={scrollProgress}
        className="CoursesCarousel__liquidEther"
        style={styleObj}
      />
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = {
          position: "absolute" as const,
          inset: 0,
          width: "100%" as const,
          height: "100%" as const,
        }
