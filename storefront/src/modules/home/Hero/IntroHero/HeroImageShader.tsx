"use client"

import FAQImageShader, {
  type CardRect,
  type GlazeImage,
  type ShaderSettingsOverride,
} from "@modules/dotazy/main/FAQImageShader"
import type { MotionValue } from "framer-motion"
import { useMemo } from "react"

type HeroImageShaderProps = {
  src: string
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  /** Overrides on top of `HERO_SETTINGS` below; omitted keys keep it. */
  settings?: ShaderSettingsOverride
}

/*
 * ─── The hero's dials ───────────────────────────────────────────────────────────────────────
 *
 * Everything below is safe to change while looking at the page; nothing here is load-bearing for
 * anything but how the hero feels. Whatever is left out falls through to `SHADER_PRESETS.hero`
 * in FAQImageShader.tsx, which is where the full list and the description of every knob lives.
 *
 * Rough ranges, from the values the three variants already use:
 *
 *   elastic.grabRadius   0.3 … 1.2   how big the cursor is on the sheet
 *   elastic.pull         0 … 0.8     how hard it drags; 0 is an inert photograph
 *   elastic.damping      0.1 … 0.4   lower keeps wobbling for longer
 *   elastic.stiffness    0.02 … 0.1  higher snaps back faster
 *   elastic.wobble       2 … 8       higher is looser and more liquid
 *   ripple.strength      0 … 0.02    how much the trail bends the picture
 *   ripple.brushSize     120 … 260   px across per stamp
 *   ripple.spacing       12 … 40     lower is a denser, wetter stroke
 *   ripple.fade          0.8 … 2.5   seconds a stamp lives
 *   ripple.dispersion    0 … 0.4     RGB split; reads as glass
 *   pointer.falloff      2 … 8       higher is a tighter spot
 *   pointer.depth        0 … 0.1     how far it pushes away
 *   light.elasticShading 0 … 0.5     light from the bend
 *   light.glaze          0 … 1       caustics and sheen
 *
 * Module-level so the object identity is stable — the shader rebuilds its scene when this
 * changes, and a fresh literal each render would rebuild it every render.
 */
const HERO_SETTINGS: ShaderSettingsOverride = {
  light: {
    elasticShading: 0.12,
    glaze: 0.045,
  },
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
  settings,
}: HeroImageShaderProps) {
  const images = useMemo(
    () => [{ src, aspect: 16 / 9 }] as const,
    [src]
  )

  /* Memoised for the same reason `HERO_SETTINGS` is module-level: a new object every render
     would tear down and rebuild the WebGL scene every render. */
  const resolvedSettings = useMemo(
    () =>
      settings
        ? {
            ...HERO_SETTINGS,
            ...settings,
            elastic: { ...HERO_SETTINGS.elastic, ...settings.elastic },
            ripple: { ...HERO_SETTINGS.ripple, ...settings.ripple },
            pointer: { ...HERO_SETTINGS.pointer, ...settings.pointer },
            light: { ...HERO_SETTINGS.light, ...settings.light },
          }
        : HERO_SETTINGS,
    [settings]
  )

  return (
    <FAQImageShader
      pointerX={pointerX}
      pointerY={pointerY}
      variant="hero"
      settings={resolvedSettings}
      imageSet={images}
      layout={heroLayout}
      classNames={heroClassNames}
    />
  )
}
