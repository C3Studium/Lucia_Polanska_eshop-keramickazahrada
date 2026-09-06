"use client"

import FAQImageShader, {
  type CardRect,
  type GlazeImage,
} from "@modules/dotazy/main/FAQImageShader"
import type { MotionValue } from "framer-motion"

type AboutHeroShaderProps = {
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  /**
   * Fotky z CMS (`o-mne.galerie`, první dvě). Chybí-li, kreslí se `aboutImages`.
   * Poměr stran jde s nimi: rozvržení karet ho počítá dřív, než se textura
   * načte, takže dopočítat ho z obrázku by znamenalo skok po načtení.
   */
  imageSet?: readonly { src: string; aspect: number }[]
}

/** Záloha pro výpadek CMS — a to, z čeho vznikly první dvě fotky bloku. */
export const aboutImages = [
  { src: "/assets/img/ome/1.png", aspect: 1079 / 626 },
  { src: "/assets/img/ome/2.png", aspect: 297 / 410 },
] as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/**
 * Zrcadlo `--hero-portrait-h: clamp(18rem, 62svh, 50rem)` z main/styles.scss.
 *
 * Jedna geometrie, jedno místo: portrét kreslí shader (tady) i CSS — stínový
 * klon, DOM záloha, clip-path karta `.Images__content` a popisek pod ní. Obě
 * strany proto musí počítat z TÉŽE osy. Portrét soupeří o výšku hero, ne
 * o šířku, takže ho řídí výška okna a šířku dopočítá poměr stran; dokud visel
 * na šířce, přerůstal hero přes horní hranu.
 *
 * `svh` se v landscape na desktopu rovná `innerHeight`; rozcházejí se až na
 * telefonu s dynamickou lištou, a ten jede větvemi <=560 / <=900 níž.
 */
const heroPortraitHeight = () => {
  if (typeof window === "undefined") return 18 * 16
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  return clamp(window.innerHeight * .62, 18 * rem, 50 * rem)
}

const getAboutCardRects = (
  width: number,
  height: number,
  images: readonly GlazeImage[]
): CardRect[] => {
  if (width <= 560) {
    /*
     * Dvojice karet přes sebe — zrcadlo bloku `below-px(560px)`
     * v main/styles.scss. Portrét je vysoký 40 % okna (dřív odvozený od jeho
     * ŠÍŘKY, takže se kompozice s poměrem stran rozjížděla) a jeho horní hrana
     * sedí na 35 %, tedy pod pravým dolním rohem široké karty, která končí
     * na 44 %.
     */
    const mainWidth = width * .72
    const mainHeight = height * .32
    const portraitHeight = height * .40
    const portraitWidth = portraitHeight * images[1].aspect

    return [
      { left: width * .035, top: height * .12, width: mainWidth, height: mainHeight },
      {
        left: width - width * .04 - portraitWidth,
        top: height * .35,
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
  const portraitHeight = heroPortraitHeight()
  const portraitWidth = portraitHeight * images[1].aspect

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
  imageSet = aboutImages,
}: AboutHeroShaderProps) {
  return (
    <FAQImageShader
      pointerX={pointerX}
      pointerY={pointerY}
      variant="about"
      imageSet={imageSet}
      layout={getAboutCardRects}
      classNames={aboutClassNames}
    />
  )
}
