"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import { useState } from "react"
import CarouselButton from "./Button"
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

export default function Carousel () {
  const [navigation, setNavigation] = useState<CarouselNavigation | null>(null)

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
        <div className="Intro__Carousel__Rail" aria-hidden="true">
          <span>02 · Výběr z ateliéru</span>
          <span className="rail__line" />
          <span>Originály pro zahradu i interiér</span>
        </div>
        <div className="Left__section">
            <div className="Content">
                <div className="text">
                    <span>Vybráno z ateliéru</span>
                    <p>Každý kus dělám rukama.</p>
                </div>

                <div className="right__content">
                    <div className="mouse__anim">
                        <div className="mouse">
                            <div className="wheel"></div>
                        </div>
                        <p>
                            Objevovat
                        </p>
                    </div>
                    <div className="buttons">
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
                <p>Máte v hlavě něco, co nikde neseženete?</p>
                <WebButton Kind="Link" title="Zakázková tvorba" href="/vyroba" alt="Zakázková keramická tvorba"/>
            </div>
        </div>
    </div>
  )
}
