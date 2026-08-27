"use client"

import LiquidEther from "@modules/home/E-com/Courses/VerticalImageCarousel/LiquidEther"
import { usePathname } from "next/navigation"
import { useMemo, type CSSProperties } from "react"

import { useDeviceTier } from "@lib/hooks/use-device-tier"
import { useShadersEnabled } from "@lib/hooks/use-shaders-enabled"
import styles from "./style.module.scss"

type AmbientPreset = {
  name: "showcase" | "legal" | "commerce" | "account"
  colors: string[]
  opacity: number
  interactive: boolean
  speed: number
  intensity: number
}

const presets: Record<AmbientPreset["name"], AmbientPreset> = {
  showcase: {
    name: "showcase",
    colors: ["#FFE8D6", "#F4CDB2", "#FFF4EA"],
    opacity: 0.2,
    interactive: true,
    speed: 0.22,
    intensity: 1.15,
  },
  legal: {
    name: "legal",
    colors: ["#eee4c9", "#d4d1a7", "#f8ead8"],
    opacity: 0.085,
    interactive: false,
    speed: 0.075,
    intensity: 0.72,
  },
  commerce: {
    name: "commerce",
    colors: ["#f4dfcd", "#c79879", "#ead7c2"],
    opacity: 0.06,
    interactive: false,
    speed: 0.065,
    intensity: 0.62,
  },
  account: {
    name: "account",
    colors: ["#c7c49a", "#ebe0c8", "#676a52"],
    opacity: 0.1,
    interactive: false,
    speed: 0.07,
    intensity: 0.68,
  },
}

const legalRoutes = [
  "/smluvni-podminky",
  "/ochrana-osobnich-udaju",
  "/odstoupeni-od-smlouvy",
  "/doprava-a-platba",
  "/cookies",
]

function getPreset(pathname: string): AmbientPreset {
  if (legalRoutes.some((route) => pathname.includes(route))) {
    return presets.legal
  }

  if (
    pathname.includes("/account") ||
    pathname.includes("/forgot-password") ||
    pathname.includes("/reset-password") ||
    pathname.includes("/verify-email")
  ) {
    return presets.account
  }

  if (
    pathname.includes("/cart") ||
    pathname.includes("/checkout") ||
    pathname.includes("/order/")
  ) {
    return presets.commerce
  }

  return presets.showcase
}

export default function GlobalLiquidEther() {
  const pathname = usePathname()
  const { isTouch, isPhone } = useDeviceTier()
  const shadersEnabled = useShadersEnabled()
  const pathSegments = pathname.split("/").filter(Boolean)
  const isHomepage = pathSegments.length <= 1
  const preset = getPreset(pathname)
  const opacity =
    preset.name === "showcase" && isHomepage ? 0.1 : preset.opacity

  /*
   * The effect stays everywhere — it is ambient, and it drives itself through autoSpeed and
   * autoIntensity without any pointer input. What changes by device is what it costs:
   *
   * - touch: no pointer forces at all. There is no cursor to follow, and a finger dragging the
   *   page should not be read as one.
   * - phone: the simulation grid and the pressure solve come right down. At this size the fine
   *   structure those buy is simply not visible, and this is a full-screen fragment shader
   *   running behind every page on a battery.
   */
  const quality = useMemo(() => {
    const interactive = preset.interactive && !isTouch

    return {
      mouseForce: interactive ? 18 : 0,
      cursorSize: interactive ? 82 : 0,
      iterationsPoisson: isPhone ? 6 : preset.interactive ? 14 : 10,
      resolution: isPhone ? 0.12 : preset.interactive ? 0.28 : 0.2,
      takeoverDuration: interactive ? 0.25 : 0,
      autoResumeDelay: interactive ? 1400 : 0,
      autoRampDuration: interactive ? 0.6 : 1.8,
      autoSpeed: isPhone ? preset.speed * 0.6 : preset.speed,
    }
  }, [preset, isTouch, isPhone])

  /* Unlike the image shaders, this one has nothing underneath it — it is an ambient overlay, so
     rendering nothing is the fallback. A full-screen fragment shader running behind every page is
     also the single most expensive thing on the site, which is why the stuttering machine gets it
     removed rather than merely downgraded. */
  if (!shadersEnabled) {
    return null
  }

  // Shader/cursor reduced-motion fallback is intentionally disabled for now, matching
  // IntroHero, omne/main and dotazy/main. This used to be `if (reducedMotion) return null`,
  // which meant the effect never mounted for anyone browsing with the OS motion preference on
  // — a setting plenty of people have enabled without knowing it, and one that took the site's
  // signature effect with it. Restore the gate (or swap it for a still render: autoSpeed 0 and
  // mouseForce 0 keep the look without the movement) when the reduced-motion pass comes round.
  //
  // The other two layers still honour the preference: LenisProvider does not initialise, and
  // the `@include reduced-motion` block in globals.scss collapses transitions and stops the
  // infinite keyframes. This is the ambient canvas only.

  return (
    <div
      aria-hidden="true"
      data-global-liquid-ether
      data-ambient-category={preset.name}
      className={styles.root}
      style={{ "--ambient-opacity": opacity } as CSSProperties}
    >
      <LiquidEther
        key={`${preset.name}-${isPhone ? "phone" : "full"}-${isTouch ? "touch" : "pointer"}`}
        mouseForce={quality.mouseForce}
        cursorSize={quality.cursorSize}
        iterationsPoisson={quality.iterationsPoisson}
        resolution={quality.resolution}
        colors={preset.colors}
        autoSpeed={quality.autoSpeed}
        autoIntensity={preset.intensity}
        takeoverDuration={quality.takeoverDuration}
        autoResumeDelay={quality.autoResumeDelay}
        autoRampDuration={quality.autoRampDuration}
        style={styleObj}
      />
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { width: "100%" as const, height: "100%" as const }
