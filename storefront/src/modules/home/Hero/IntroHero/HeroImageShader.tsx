"use client"

import FAQImageShader, {
  type CardRect,
  type GlazeImage,
} from "@modules/dotazy/main/FAQImageShader"
import type { MotionValue } from "framer-motion"
import { useMemo } from "react"

type HeroImageShaderProps = {
  src: string
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
}

const heroLayout = (
  width: number,
  height: number,
  _images: readonly GlazeImage[]
): CardRect[] => [
  {
    left: -width * 0.035,
    top: -height * 0.08,
    width: width * 1.07,
    height: height * 1.16,
  },
]

const heroClassNames = {
  root: "homeHeroShader",
  shadows: "homeHeroShaderShadows",
  fallback: "homeHeroShaderFallback",
  fallbackImage: "homeHeroShaderFallbackImage",
}

export default function HeroImageShader({
  src,
  pointerX,
  pointerY,
}: HeroImageShaderProps) {
  const images = useMemo(
    () => [{ src, aspect: 16 / 9 }] as const,
    [src]
  )

  return (
    <FAQImageShader
      pointerX={pointerX}
      pointerY={pointerY}
      variant="hero"
      imageSet={images}
      layout={heroLayout}
      classNames={heroClassNames}
    />
  )
}
