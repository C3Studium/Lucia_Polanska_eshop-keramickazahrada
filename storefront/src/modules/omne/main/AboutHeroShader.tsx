"use client"

import FAQImageShader, {
  type CardRect,
  type GlazeImage,
} from "@modules/dotazy/main/FAQImageShader"
import type { MotionValue } from "framer-motion"

type AboutHeroShaderProps = {
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
}

const aboutImages = [
  { src: "/assets/img/ome/1.png", aspect: 1079 / 626 },
  { src: "/assets/img/ome/2.png", aspect: 297 / 410 },
] as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const getAboutCardRects = (
  width: number,
  height: number,
  images: readonly GlazeImage[]
): CardRect[] => {
  if (width <= 560) {
    const mainWidth = width * .93
    const mainHeight = height * .46
    const portraitWidth = Math.min(width * .48, 245)
    const portraitHeight = portraitWidth / images[1].aspect

    return [
      { left: width * .035, top: height * .09, width: mainWidth, height: mainHeight },
      {
        left: width - 18 - portraitWidth,
        top: height - height * .05 - portraitHeight,
        width: portraitWidth,
        height: portraitHeight,
      },
    ]
  }

  if (width <= 900) {
    const mainWidth = width * .88
    const mainHeight = height * .53
    const portraitWidth = Math.min(width * .42, 340)
    const portraitHeight = portraitWidth / images[1].aspect

    return [
      { left: width * .035, top: height * .1, width: mainWidth, height: mainHeight },
      {
        left: width - width * .04 - portraitWidth,
        top: height - height * .06 - portraitHeight,
        width: portraitWidth,
        height: portraitHeight,
      },
    ]
  }

  const mainWidth = width * .62
  const mainHeight = height * .56
  const portraitWidth = clamp(width * .315, 440, 580)
  const portraitHeight = portraitWidth / images[1].aspect

  return [
    {
      left: width * .1,
      top: height * .17,
      width: mainWidth,
      height: mainHeight,
    },
    {
      left: width - width * .12 - portraitWidth,
      top: height - height * .08 - portraitHeight,
      width: portraitWidth,
      height: portraitHeight,
    },
  ]
}

const aboutClassNames = {
  root: "aboutHeroShader",
  shadows: "aboutHeroShaderShadows",
  fallback: "aboutHeroShaderFallback",
  fallbackImage: "aboutHeroShaderFallbackImage",
}

export default function AboutHeroShader({
  pointerX,
  pointerY,
}: AboutHeroShaderProps) {
  return (
    <FAQImageShader
      pointerX={pointerX}
      pointerY={pointerY}
      variant="about"
      imageSet={aboutImages}
      layout={getAboutCardRects}
      classNames={aboutClassNames}
    />
  )
}
