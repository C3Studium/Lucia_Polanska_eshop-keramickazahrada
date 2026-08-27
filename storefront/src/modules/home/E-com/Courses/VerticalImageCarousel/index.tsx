"use client"

import Image from "next/image"
import type { MotionValue } from "framer-motion"
import LiquidImageCarousel from "./LiquidImageCarousel"
import { useShadersEnabled } from "@lib/hooks/use-shaders-enabled"

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
  const shadersEnabled = useShadersEnabled()

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

      {/* The base <Image> above is the fallback: it is always rendered, and the liquid layer
          simply sits on top of it when shaders are allowed. */}
      {shadersEnabled && (
        <LiquidImageCarousel
          images={images}
          scrollProgress={scrollProgress}
          /*
           * The brush stays, at roughly a third of its former weight (Matěj, 2026-08-24). The
           * defaults — 18 of mouse force, a 50px cursor and an auto-driver at 1.5 — smeared the
           * whole frame every time the pointer crossed it, which on a full-bleed photograph
           * behind body copy is the loudest thing on the page. The fluid still paints, it just
           * no longer takes the photograph with it.
           */
          mouseForce={7}
          cursorSize={38}
          autoSpeed={0.19}
          autoIntensity={0.7}
          className="CoursesCarousel__liquidEther"
          style={styleObj}
        />
      )}
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
