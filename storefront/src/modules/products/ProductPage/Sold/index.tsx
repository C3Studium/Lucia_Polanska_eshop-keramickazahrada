"use client"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  wrap,
  type PanInfo,
} from "framer-motion"
import Image from "next/image"
import {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
} from "react"

type SoldProductsProps = {
  products: HttpTypes.StoreProduct[]
}

type ProductRailProps = {
  products: HttpTypes.StoreProduct[]
}

const BASE_SPEED = 34
const DRAG_FRICTION = 4.8
const MAX_DRAG_VELOCITY = 2400
const SCROLL_FRICTION = 5.6
const MAX_SCROLL_BOOST = 520

function ProductRail({ products }: ProductRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const firstGroupRef = useRef<HTMLDivElement>(null)
  const loopWidthRef = useRef(0)
  const resetBufferRef = useRef(0)
  const hasInitialPositionRef = useRef(false)
  const usesNativeScrollRef = useRef(false)
  /* The global reduced-motion CSS layer cannot stop this JS-driven marquee —
     it has to opt out itself. Dragging stays; the perpetual drift stops. */
  const reduceMotion = useReducedMotion()
  const lastFocusUpdateRef = useRef(0)
  const directionRef = useRef(-1)
  const isDraggingRef = useRef(false)
  const dragMovedRef = useRef(false)
  const baseX = useMotionValue(0)
  const dragVelocity = useMotionValue(0)
  const scrollBoost = useMotionValue(0)
  const railProducts =
    products.length >= 4
      ? products
      : Array.from({ length: Math.ceil(4 / products.length) }, () => products)
          .flat()
          .slice(0, 4)

  const updateFocus = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || usesNativeScrollRef.current) return

    /* Ohnisko i poloměr se čtou z railu, ne z window.innerWidth. Nad 1921 je rám
       zastropovaný na 100svh*1.6, takže obrazovka a rám nejsou totéž: na 2552x1351 je rám
       2162px, ale 38 % obrazovky je 970px, což je 44,9 % rámu — ohnisko se posunulo o skoro
       sedminu rámu doprava a největší karta se zvětšovala jinde, než kam se člověk dívá.
       `viewport` je width:100% uvnitř .pageFrame, takže jeho šířka JE rám; pod 1921 je to
       táž hodnota jako innerWidth. Jeden rect na celý výpočet, ne dvě měření. */
    const rail = viewport.getBoundingClientRect()
    const focusPoint = rail.left + rail.width * 0.38
    const focusRadius = Math.max(rail.width * 0.34, 420)

    viewport
      .querySelectorAll<HTMLElement>("[data-related-card]")
      .forEach((card) => {
        const rect = card.getBoundingClientRect()
        const distance = Math.abs(rect.left + rect.width / 2 - focusPoint)
        const focus = Math.max(0, 1 - distance / focusRadius)
        card.style.setProperty("--card-focus", focus.toFixed(3))
      })
  }, [])

  useEffect(() => {
    const group = firstGroupRef.current
    if (!group) return

    const updateMeasurements = () => {
      loopWidthRef.current = group.getBoundingClientRect().width
      const firstCard = group.querySelector<HTMLElement>("[data-related-card]")
      resetBufferRef.current = firstCard
        ? firstCard.getBoundingClientRect().width * 0.5
        : 0

      if (!hasInitialPositionRef.current) {
        baseX.set(-resetBufferRef.current)
        hasInitialPositionRef.current = true
      }

      updateFocus()
    }
    const resizeObserver = new ResizeObserver(updateMeasurements)

    resizeObserver.observe(group)
    updateMeasurements()

    return () => resizeObserver.disconnect()
  }, [baseX, updateFocus])

  useEffect(() => {
    /* Tyhle dva výrazy a dvojice `@include below-px(760px)` + `@include h(phs)` ve
       style.scss MUSÍ zůstat v zákrytu. Jsou to dvě půlky jednoho přepínače: CSS udělá
       z pásu nativní scroll-snap carousel, JS ho tímhle refem odpojí od marquee smyčky.
       Když se rozejdou, nikdo to neohlásí — jen se stane jedna ze dvou tichých věcí:
         · CSS pustí marquee a JS ne  -> usesNativeScrollRef umlčí updateFocus
           i scroll impulsy, rail stojí a ohnisko je mrtvé;
         · JS pustí marquee a CSS ne  -> transform se hýbe pod overflow-x: auto,
           a protože v tom režimu je vysázená jen jedna skupina, po jednom oběhu
           smyčky pás skočí.

       Nativní režim je proto přesně to, co zbyde po odečtení: telefonní fold MÍNUS
       telefon na šířku, kterému ten blok v CSS odvolává `@include h(phs)`. Napsané
       jako obyčejné media query, ne jedna s Level 4 `not` — matchMedia na dotaz,
       kterému prohlížeč nerozumí, tiše vrací false, a to by tady znamenalo marquee
       nad nativním scrollerem. Řetězec phs je doslova to, co emituje h-query(phs)
       ze styles/system/_mixins.scss.

       Fold sám je od tabletového kola dvoučlenný, protože holé `max-width: 760px`
       si bralo i svislé tablety: 744x1133 (iPad mini 6) a 600x960 dostávaly celou
       telefonní kompozici sekce, včetně nativního pásu s jedinou vysázenou skupinou.
       Členy jsou tytéž dva, které stojí v style.scss — svislý telefon (< 600px)
       a krátká šířka do 760px. Telefon o nic nepřišel: nejširší svislý telefon má
       430px, a 568x320 i 736x414 chytá druhý člen. */
    const phonePortrait = window.matchMedia("(max-width: 599.98px)")
    const shortLandscape = window.matchMedia(
      "(max-width: 760px) and (orientation: landscape)"
    )
    const phoneLandscape = window.matchMedia(
      "(min-width: 480px) and (max-height: 520px) and (orientation: landscape)"
    )
    const queries = [phonePortrait, shortLandscape, phoneLandscape]

    const updateMode = () => {
      const foldApplies = phonePortrait.matches || shortLandscape.matches
      usesNativeScrollRef.current = foldApplies && !phoneLandscape.matches
      if (usesNativeScrollRef.current) {
        baseX.set(0)
      }
    }

    updateMode()
    queries.forEach((q) => q.addEventListener("change", updateMode))
    return () => {
      queries.forEach((q) => q.removeEventListener("change", updateMode))
    }
  }, [baseX])

  useEffect(() => {
    let lastScrollY = window.scrollY

    const applyScrollImpulse = (delta: number, multiplier: number) => {
      if (usesNativeScrollRef.current || Math.abs(delta) < 0.5) return

      directionRef.current = delta > 0 ? -1 : 1
      const impulse = Math.min(MAX_SCROLL_BOOST, Math.abs(delta) * multiplier)
      scrollBoost.set(
        Math.max(impulse, Math.min(MAX_SCROLL_BOOST, scrollBoost.get() * 0.82))
      )
    }

    const handleWheel = (event: WheelEvent) => {
      applyScrollImpulse(event.deltaY, 3.2)
    }

    const handleScroll = () => {
      const nextScrollY = window.scrollY
      applyScrollImpulse(nextScrollY - lastScrollY, 12)
      lastScrollY = nextScrollY
    }

    window.addEventListener("wheel", handleWheel, { passive: true })
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("wheel", handleWheel)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [scrollBoost])

  useAnimationFrame((time, delta) => {
    if (usesNativeScrollRef.current || !loopWidthRef.current) {
      return
    }

    const frameSeconds = Math.min(delta / 1000, 0.05)

    if (!isDraggingRef.current) {
      const automaticMovement = reduceMotion
        ? 0
        : directionRef.current * (BASE_SPEED + scrollBoost.get()) * frameSeconds
      const momentumMovement = dragVelocity.get() * frameSeconds
      const nextX = baseX.get() + automaticMovement + momentumMovement
      const resetBuffer = resetBufferRef.current

      baseX.set(wrap(-loopWidthRef.current - resetBuffer, -resetBuffer, nextX))
      scrollBoost.set(
        scrollBoost.get() * Math.exp(-SCROLL_FRICTION * frameSeconds)
      )
      dragVelocity.set(
        dragVelocity.get() * Math.exp(-DRAG_FRICTION * frameSeconds)
      )
    }

    if (time - lastFocusUpdateRef.current > 32) {
      lastFocusUpdateRef.current = time
      updateFocus()
    }
  })

  const handlePanStart = () => {
    if (usesNativeScrollRef.current) return
    isDraggingRef.current = true
    dragMovedRef.current = false
    dragVelocity.set(0)
  }

  const handlePan = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (!isDraggingRef.current || !loopWidthRef.current) return

    const deltaX = info.delta.x

    if (Math.abs(deltaX) > 0.5) {
      dragMovedRef.current = true
      directionRef.current = deltaX > 0 ? 1 : -1
    }

    const resetBuffer = resetBufferRef.current
    baseX.set(
      wrap(
        -loopWidthRef.current - resetBuffer,
        -resetBuffer,
        baseX.get() + deltaX
      )
    )

    const panVelocity = Math.max(
      -MAX_DRAG_VELOCITY,
      Math.min(MAX_DRAG_VELOCITY, info.velocity.x)
    )
    dragVelocity.set(dragVelocity.get() * 0.35 + panVelocity * 0.65)
    updateFocus()
  }

  const handlePanEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (!isDraggingRef.current) return

    isDraggingRef.current = false
    const releaseVelocity = Math.max(
      -MAX_DRAG_VELOCITY,
      Math.min(MAX_DRAG_VELOCITY, info.velocity.x)
    )
    dragVelocity.set(releaseVelocity)
    if (Math.abs(releaseVelocity) > 1) {
      directionRef.current = releaseVelocity > 0 ? 1 : -1
    }
    requestAnimationFrame(() => {
      dragMovedRef.current = false
    })
  }

  const preventDraggedLink = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragMovedRef.current) return

    event.preventDefault()
    event.stopPropagation()
    dragMovedRef.current = false
  }

  const renderGroup = (copy: number) => (
    <div
      className="soldProducts__railGroup"
      ref={copy === 0 ? firstGroupRef : undefined}
      aria-hidden={copy > 0}
    >
      {railProducts.map((product, index) => {
        const image = product.thumbnail || product.images?.[0]?.url
        const collection = product.collection?.title

        return (
          <LocalizedClientLink
            href={`/products/${product.handle}`}
            className="soldProducts__card"
            data-related-card
            draggable={false}
            onDragStart={(event: ReactDragEvent<HTMLAnchorElement>) =>
              event.preventDefault()
            }
            key={`${copy}-${product.id}-${index}`}
            tabIndex={copy > 0 ? -1 : undefined}
            aria-label={`Zobrazit ${product.title}`}
          >
            <div className="soldProducts__cardImage">
              {image && (
                <Image
                  src={image}
                  alt=""
                  fill
                  draggable={false}
                  quality={100}
                  /* První podmínka je telefon na šířku (phs/phl): karta tam má
                     34vw, ne 78vw, a bez ní by si telefon stahoval dvakrát větší
                     obrázek, než jaký zobrazí. Pořadí je závazné, platí první
                     shoda. */
                  /* Druhá a třetí podmínka jsou tytéž dva členy jako telefonní
                     fold ve style.scss — 78vw platí jen tam, kde CSS opravdu
                     dává kartě 78vw. Svislý tablet 600–760px má od tabletového
                     kola základní kartu (clamp(20.625rem, 29vw, 35rem) stojí
                     v celém pásmu na podlaze 330px, tedy 55vw na 600px). */
                  sizes="(min-width: 480px) and (max-height: 520px) and (orientation: landscape) 34vw, (max-width: 599.98px) 78vw, (max-width: 760px) and (orientation: landscape) 78vw, (max-width: 760px) 55vw, (max-width: 1200px) 42vw, 31vw"
                />
              )}
              <span className="soldProducts__imageIndex">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="soldProducts__imageAction" aria-hidden="true">
                Otevřít <i>↗</i>
              </span>
            </div>
            <div className="soldProducts__cardMeta">
              <div>
                <span>{collection || "Z ateliéru"}</span>
                <h3>{product.title}</h3>
              </div>
              <span className="soldProducts__arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </LocalizedClientLink>
        )
      })}
    </div>
  )

  return (
    <motion.div
      className="soldProducts__viewport"
      ref={viewportRef}
      /* data-lenis-prevent: ve svislém režimu je tenhle prvek vlastní vodorovný
         scroll kontejner uvnitř Lenis stránky (lib/context/LenisContext.tsx). Bez
         toho Lenis spolkne wheel i touch a odscrolluje stránku místo seznamu. Na
         skutečném dotyku se Lenis sám vypíná, takže tohle je pro myš nad úzkým
         oknem a pro emulaci v devtools — právě tam, kde se to testuje. */
      data-lenis-prevent
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      onClickCapture={preventDraggedLink}
      onDragStart={(event) => event.preventDefault()}
      onScroll={updateFocus}
    >
      <motion.div className="soldProducts__rail" style={{ x: baseX }}>
        {renderGroup(0)}
        {renderGroup(1)}
      </motion.div>
    </motion.div>
  )
}

export default function SoldProducts({ products }: SoldProductsProps) {
  if (!products.length) return null
  const isCollectionSelection = products.some(
    (product) => product.collection_id
  )

  return (
    <section
      className="soldProducts"
      id="product-related"
      data-scroll-section
      data-scroll-label="Další výrobky"
      aria-labelledby="next-objects-title"
    >
      <div className="soldProducts__head">
        <span>Mohlo by se hodit · 03</span>
        <div className="soldProducts__line" />
        <span>
          {isCollectionSelection ? "Ze stejné kolekce" : "Z ateliéru"}
        </span>
      </div>

      <div className="soldProducts__intro">
        <h2 id="next-objects-title">
          Podívejte se ještě
          <em> na tyhle kousky.</em>
        </h2>
        <p>
          {isCollectionSelection
            ? "Další kusy ze stejné kolekce."
            : "Další kusy, které mám teď v ateliéru."}{" "}
          Všechno vzniká ručně a jen v malém počtu.
        </p>
      </div>

      <ProductRail products={products} />

      <div className="soldProducts__foot" aria-hidden="true">
        <span>Posuňte doprava</span>
        <div />
        <span>Z ateliéru</span>
      </div>
    </section>
  )
}
