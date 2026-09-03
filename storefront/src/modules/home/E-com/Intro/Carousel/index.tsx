"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock, CopyButton } from "@lib/util/site-copy"
import WebButton from "@modules/common/components/Buttons/webButton"
import { useState, type CSSProperties } from "react"
import CarouselButton, { BUTTONS_RESERVE } from "./Button"
import ImageCarousel, {
  CarouselImage,
  CarouselNavigation,
} from "./ImageCarousel"

const leftCarouselImages: CarouselImage[] = [
  { id: 1, src: "/assets/img/img/7.jpg", alt: "Keramika pokrytá modrými květy" },
  { id: 2, src: "/assets/img/img/10.jpg", alt: "Keramický reliéf s květy" },
  { id: 3, src: "/assets/img/img/8.jpg", alt: "Keramická slepice v zahradě" },
  { id: 4, src: "/assets/img/img/4.jpg", alt: "Autorská keramická socha" },
  { id: 5, src: "/assets/img/img/1.jpg", alt: "Drobný keramický medvěd" },
  { id: 6, src: "/assets/img/img/5.jpg", alt: "Detail modelování keramického obličeje" },
]

const rightCarouselImages: CarouselImage[] = [
  { id: 1, src: "/assets/img/img/10.jpg", alt: "Detail keramického reliéfu" },
  { id: 2, src: "/assets/img/img/6.jpg", alt: "Ručně modelovaná keramická tvář" },
  { id: 3, src: "/assets/img/img/11.jpg", alt: "Lucie Polanská při práci v ateliéru" },
  { id: 4, src: "/assets/img/img/7.jpg", alt: "Keramický výrobek v zahradě" },
  { id: 5, src: "/assets/img/img/12.jpg", alt: "Portrét z keramického ateliéru" },
  { id: 6, src: "/assets/img/img/3.jpg", alt: "Ruční práce na velkém keramickém výrobku" },
]

export default function Carousel ({
  block,
  cta,
}: {
  /**
   * Texty téhle sekce (`index.ecom-carousel`).
   *
   * Vlastní blok, ne sdílený s `index.ecom-intro` nad ní: jsou to dvě sekce s vlastní
   * lištou („01 · Keramická zahrada" a „02 · Výběr z ateliéru") a redaktor upravuje jednu,
   * aniž by věděl o druhé.
   *
   * Fotky sem NEPATŘÍ a nejsou tu schválně. Karusel je bere odjinud a sahat na ně přes CMS
   * už jednou rozbilo backend i e-shop.
   */
  block?: CopyBlock
  cta?: CopyButton
}) {
  const [navigation, setNavigation] = useState<CarouselNavigation | null>(null)

  /* Bez tohohle nejsou texty téhle sekce v editoru upravitelné. Karusel má jediný stav —
     šipky — takže se po zapnutí režimu editace sám nepřekreslí a `editable()` mu navždy
     zůstane prázdné. Viz komentář v hooku. */
  useEditRerender()

  const railLeft = block?.accent?.[0]?.trim() || "02 · Výběr z ateliéru"
  const railRight = block?.accent?.[1]?.trim() || "Originály pro zahradu i interiér"
  const scrollHint = block?.accent?.[2]?.trim() || "Objevovat"
  const eyebrow = block?.title?.trim() || "Vybráno z ateliéru"
  const lede = block?.bodyText?.trim() || "Každý kus dělám rukama."
  const customOrders =
    block?.headline?.trim() || "Máte v hlavě něco, co nikde neseženete?"

  const navigate = (
    delta: CarouselNavigation["delta"],
    speed: CarouselNavigation["speed"]
  ) => {
    setNavigation((current) => ({
      id: (current?.id ?? 0) + 1,
      delta,
      speed,
    }))
  }

  return (
    <div className="Intro__Carousel">
        {/* `aria-hidden` zůstává — lišta je typografická ozdoba a čtečce nic nepřidá.
            Anotace pro vizuální editaci na tom nezávisí: překryv čte DOM. */}
        <div className="Intro__Carousel__Rail" aria-hidden="true">
          <span {...editable(block, "accent.0")}>{railLeft}</span>
          <span className="rail__line" />
          <span {...editable(block, "accent.1")}>{railRight}</span>
        </div>
        <div className="Left__section">
            <div className="Content">
                <div className="text">
                    <span {...editable(block, "title")}>{eyebrow}</span>
                    <p {...editable(block, "body")}>{lede}</p>
                </div>

                <div className="right__content">
                    <div className="mouse__anim">
                        <div className="mouse">
                            <div className="wheel"></div>
                        </div>
                        <p {...editable(block, "accent.2")}>
                            {scrollHint}
                        </p>
                    </div>
                    {/* The lane the pills grow into, measured from the pill geometry
                        itself — see BUTTONS_RESERVE in ./Button. */}
                    <div
                        className="buttons"
                        style={{ "--buttons-reserve": `${BUTTONS_RESERVE}px` } as CSSProperties}
                    >
                        <CarouselButton
                            src="/assets/links/home_img.png"
                            alt="Previous carousel image"
                            left={true}
                            onClick={(speed) => navigate(-1, speed)}
                        />
                        <CarouselButton
                            src="/assets/links/home_img.png"
                            alt="Next carousel image"
                            left={false}
                            onClick={(speed) => navigate(1, speed)}
                        />
                    </div>
                </div>
            </div>
            <div className="Images">
                <ImageCarousel
                    images={leftCarouselImages}
                    direction="left-to-right"
                    delay={0}
                    navigation={navigation}
                />
            </div>
        </div>
        <div className="Right__section">
            <div className="Images">
                <ImageCarousel
                    images={rightCarouselImages}
                    direction="right-to-left"
                    delay={0.25}
                    navigation={navigation}
                />
            </div>

            <div className="Custom__orders">
                <p {...editable(block, "headline")}>{customOrders}</p>
                <span {...editable(cta, "label")}>
                    <WebButton Kind="Link" title={cta?.label?.trim() || "Zakázková tvorba"} href="/vyroba" alt="Zakázková keramická tvorba"/>
                </span>
            </div>
        </div>
    </div>
  )
}
