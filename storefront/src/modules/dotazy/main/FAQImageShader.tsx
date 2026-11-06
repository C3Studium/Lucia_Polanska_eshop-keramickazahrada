"use client"

import type { MotionValue } from "framer-motion"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useMemo, useState } from "react"

import { useShadersEnabled } from "@lib/hooks/use-shaders-enabled"

/* three.js a celá scéna se načtou, až když shadery opravdu poběží (viz FAQImageShaderScene). */
const FAQImageShaderScene = dynamic(() => import("./FAQImageShaderScene"), { ssr: false })

/**
 * Every number that changes how this shader feels, in one place.
 *
 * The values used to be three separate things — module constants, a per-variant ripple literal,
 * and uniform initialisers with `isHero ? … : isAbout ? … : …` ternaries — spread across 400
 * lines. Tuning meant finding all three. Now a variant is a preset below, and a caller overrides
 * any leaf of it with the `settings` prop.
 */
export type ShaderSettings = {
  /** The sheet's own springs — how the picture behaves as a material. */
  elastic: {
    /** Pull back toward flat. Higher snaps back faster. */
    stiffness: number
    /** Energy lost per step. Higher settles sooner; 0 wobbles forever. */
    damping: number
    /** Cursor size on the sheet, where the card is 2 units tall. The big knob. */
    grabRadius: number
    /** How hard the cursor drags. 0 = the sheet ignores it. */
    pull: number
    /** How much neighbours follow one another. Higher is looser and more liquid. */
    wobble: number
  }

  /** The brush trail stamped into the shared displacement field — the liquid effect. */
  ripple: {
    /** Diameter of one stamp, in pixels. */
    brushSize: number
    /** How far the trail refracts the photograph. The visible strength. */
    strength: number
    /** How much the push direction turns with the amount — the curl in the trail. */
    swirl: number
    /** Concentric rings per stamp. */
    rings: number
    /** How far each stamp grows from its start size. */
    spread: number
    /** Seconds until a stamp is gone. */
    fade: number
    /** Pixels of travel between stamps. Lower is a denser, wetter stroke. */
    spacing: number
    /** RGB split along the push. 0 = none; small numbers read as glass. */
    dispersion: number
  }

  /** What the pointer does to the geometry, before any light. */
  pointer: {
    /** How tightly the effect hugs the cursor. Higher is a smaller, sharper spot. */
    falloff: number
    /** How far the sheet pushes away under the cursor. */
    depth: number
    /** How much the corners lift toward the cursor. */
    cornerStrength: number
    /** Idle drift in those corners. */
    cornerMotion: number
  }

  /** The two terms that touch colour. Both 0 leaves the photograph exactly as authored. */
  light: {
    /** Light and shadow raised by bending the sheet. */
    elasticShading: number
    /** Caustics, glaze ring and corner sheen. */
    glaze: number
  }

  /** How quickly things chase their targets. Lower is heavier and laggier. */
  follow: {
    /** Cursor smoothing. The single biggest lever on whether it feels immediate or floaty. */
    pointerEase: number
    /** How fast a card slides to its laid-out position. */
    positionEase: number
    /** How fast it settles its tilt. */
    rotationEase: number
    /** How fast hover fades in and out under the cursor. */
    hoverEase: number
    /** How fast the speed-driven energy term rises as the cursor accelerates. */
    energyAttack: number
    /** …and falls when it slows. Lower leaves a longer tail of motion. */
    energyRelease: number
  }

  /**
   * Nodes per side of the elastic lattice. The cost is O(n²) per substep, so this is the one
   * number here that is about frame rate rather than feel: more nodes is a smoother bend and a
   * proportionally more expensive one.
   */
  latticeDensity: number

  /** Canvas density. 2 matches a retina <img>; lower trades sharpness for fill rate. */
  maxPixelRatio: number
}

/** Every leaf optional, so a caller overrides one number without restating the preset. */
export type ShaderSettingsOverride = {
  [K in keyof ShaderSettings]?: ShaderSettings[K] extends object
    ? Partial<ShaderSettings[K]>
    : ShaderSettings[K]
}

/**
 * The three variants, as they were before this was collected — same numbers, one place.
 *
 * `default` is the FAQ cards: small, handled directly, so everything is at full strength.
 * `about` and `hero` are large photographs with type over them, where the same values read as
 * the picture being mauled — hence the much lower pointer falloff and near-zero glaze.
 */
export const SHADER_PRESETS: Record<"default" | "about" | "hero", ShaderSettings> = {
  default: {
    elastic: { stiffness: 0.05, damping: 0.75, grabRadius: 0.05, pull: 0.5, wobble: 0.025 },
    ripple: { brushSize: 100, strength: 0.005, swirl: 1.25, rings: 1, spread: 1, fade: 1.75, spacing: 1, dispersion: 0.5 },
    pointer: { falloff: 0.65, depth: 0.062, cornerStrength: 0.01, cornerMotion: 0.004 },
    light: { elasticShading: 0.02, glaze: 0.5 },
    follow: { pointerEase: 0.052, positionEase: 0.052, rotationEase: 0.045, hoverEase: 0.045, energyAttack: 0.16, energyRelease: 0.04 },
    latticeDensity: 26,
    maxPixelRatio: 20,
  },
  about: {
    elastic: { stiffness: 0.05, damping: 0.75, grabRadius: 0.05, pull: 0.5, wobble: 0.025 },
    ripple: { brushSize: 100, strength: 0.005, swirl: 1.25, rings: 1, spread: 1, fade: 1.75, spacing: 1, dispersion: 0.5 },
    pointer: { falloff: 0.65, depth: 0.062, cornerStrength: 0.01, cornerMotion: 0.004 },
    light: { elasticShading: 0.02, glaze: 0.5 },
    follow: { pointerEase: 0.052, positionEase: 0.052, rotationEase: 0.045, hoverEase: 0.045, energyAttack: 0.16, energyRelease: 0.04 },
    latticeDensity: 26,
    maxPixelRatio: 20,
  },
  hero: {
    elastic: { stiffness: 0.05, damping: 0.75, grabRadius: 0.05, pull: 0.5, wobble: 0.025 },
    ripple: { brushSize: 100, strength: 0.005, swirl: 1.25, rings: 1, spread: 1, fade: 1.75, spacing: 1, dispersion: 0.5 },
    pointer: { falloff: 0.65, depth: 0.062, cornerStrength: 0.01, cornerMotion: 0.004 },
    light: { elasticShading: 0.02, glaze: 0.5 },
    follow: { pointerEase: 0.052, positionEase: 0.052, rotationEase: 0.045, hoverEase: 0.045, energyAttack: 0.16, energyRelease: 0.04 },
    latticeDensity: 26,
    maxPixelRatio: 20,
  },
}

/** Preset first, caller's overrides on top, one group at a time. */
export function resolveSettings(
  variant: "default" | "about" | "hero",
  override?: ShaderSettingsOverride
): ShaderSettings {
  const base = SHADER_PRESETS[variant]

  if (!override) return base

  return {
    elastic: { ...base.elastic, ...override.elastic },
    follow: { ...base.follow, ...override.follow },
    latticeDensity: override.latticeDensity ?? base.latticeDensity,
    ripple: { ...base.ripple, ...override.ripple },
    pointer: { ...base.pointer, ...override.pointer },
    light: { ...base.light, ...override.light },
    maxPixelRatio: override.maxPixelRatio ?? base.maxPixelRatio,
  }
}

type FAQImageShaderProps = {
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  variant?: "default" | "about" | "hero"
  /** Override any leaf of the variant's preset — see `SHADER_PRESETS`. */
  settings?: ShaderSettingsOverride
  imageSet?: readonly GlazeImage[]
  layout?: (width: number, height: number, images: readonly GlazeImage[]) => CardRect[]
  classNames?: {
    root: string
    shadows: string
    fallback: string
    fallbackImage: string
  }
}

export type GlazeImage = {
  src: string
  aspect: number
  /*
   * Obrázek pro zálohu (nenačte-li se shader: bez WebGL, při chybě, než naběhne).
   * Shader kreslí vždy `src`; když `fallbackSrc` chybí, kreslí ho i záloha, takže
   * pro volající, co posílají jen `src` (dotazy, o mně), se nic nemění. Hero tím
   * napojuje vlastní „záložní" fotku z CMS, nezávislou na té pro shader.
   */
  fallbackSrc?: string
}

/*
 * Záloha pro výpadek CMS — a zároveň to, z čeho vznikl blok `dotazy.galerie`.
 *
 * Exportované, aby si `DotazyMain` mohl vzít poměry stran i tehdy, když fotku
 * z CMS nemá: shader je potřebuje dřív, než se textura načte, a délka pole
 * určuje počet karet. Viz `shaderImages()` v `@lib/util/site-copy`.
 */
export const faqImages = [
  { src: "/assets/img/faq/FAQ1.png", aspect: 420 / 265 },
  { src: "/assets/img/faq/FAQ2.png", aspect: 213 / 294 },
  { src: "/assets/img/faq/FAQ3.png", aspect: 420 / 260 },
] as const

export type CardRect = { left: number; top: number; width: number; height: number }

function getCardRects(width: number, height: number, images: readonly GlazeImage[]): CardRect[] {
  if (width <= 640) {
    return [
      { left: width * 0.03, top: height * 0.22, width: width * 0.64, height: (width * 0.64) / images[0].aspect },
      { left: width * 0.45, top: height * 0.41, width: width * 0.32, height: (width * 0.32) / images[1].aspect },
      { left: width * 0.12, top: height * 0.6, width: width * 0.7, height: (width * 0.7) / images[2].aspect },
    ]
  }

  const widths = [width * 0.31, width * 0.165, width * 0.32]
  return [
    { left: width * 0.045, top: height * 0.115, width: widths[0], height: widths[0] / images[0].aspect },
    { left: width * 0.24, top: height * 0.285, width: widths[1], height: widths[1] / images[1].aspect },
    { left: width * 0.34, top: height * 0.47, width: widths[2], height: widths[2] / images[2].aspect },
  ]
}

export default function FAQImageShader({
  pointerX,
  pointerY,
  variant = "default",
  settings,
  imageSet = faqImages,
  layout = getCardRects,
  classNames = {
    root: "faqShaderCanvas",
    shadows: "faqShaderShadows",
    fallback: "faqShaderFallback",
    fallbackImage: "faqShaderFallbackImage",
  },
}: FAQImageShaderProps) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const shadersEnabled = useShadersEnabled()

  /* Stejná identita jako dřív `settings` + `variant` v závislostech efektu: scéna se staví znovu jen, když se změní. */
  const config = useMemo(() => resolveSettings(variant, settings), [variant, settings])

  return (
    <div
      className={`${classNames.root} ${ready ? "is-ready" : ""} ${failed ? "is-error" : ""}`}
      data-shader-state={
        !shadersEnabled ? "disabled" : failed ? "error" : ready ? "ready" : "loading"
      }
      aria-hidden="true"
    >
      <div className={classNames.shadows}>
        {imageSet.map((image) => <i key={image.src} />)}
      </div>
      {shadersEnabled && (
        <FAQImageShaderScene
          pointerX={pointerX}
          pointerY={pointerY}
          variant={variant}
          config={config}
          imageSet={imageSet}
          layout={layout}
          setReady={setReady}
          setFailed={setFailed}
        />
      )}
      <div className={classNames.fallback}>
        {imageSet.map((image) => (
          <div className={classNames.fallbackImage} key={image.src}>
            {/*
              `quality={100}` because this still stands in for the shader, which draws the file
              itself off disk with no re-encode at all. At next/image's default 75 the swap
              between them shows as the photograph getting softer, which is the one difference
              the two are not supposed to have.
            */}
            <Image
              src={image.fallbackSrc ?? image.src}
              alt=""
              fill
              sizes="(max-width: 640px) 70vw, 32vw"
              quality={100}
              priority
            />
          </div>
        ))}
      </div>
    </div>
  )
}
