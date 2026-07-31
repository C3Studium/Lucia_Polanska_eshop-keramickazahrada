"use client"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  motion,
  useAnimationFrame,
  useMotionValue,
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

    const focusPoint =
      viewport.getBoundingClientRect().left + window.innerWidth * 0.38
    const focusRadius = Math.max(window.innerWidth * 0.34, 420)

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
    const media = window.matchMedia("(max-width: 760px)")

    const updateMode = () => {
      usesNativeScrollRef.current = media.matches
      if (usesNativeScrollRef.current) {
        baseX.set(0)
      }
    }

    updateMode()
    media.addEventListener("change", updateMode)
    return () => media.removeEventListener("change", updateMode)
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
      const automaticMovement =
        directionRef.current * (BASE_SPEED + scrollBoost.get()) * frameSeconds
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
                  sizes="(max-width: 760px) 78vw, (max-width: 1200px) 42vw, 31vw"
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
                <span>{collection || "Objekt z ateliéru"}</span>
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
      data-scroll-label="Další objekty"
      aria-labelledby="next-objects-title"
    >
      <div className="soldProducts__head">
        <span>Další kapitola · 03</span>
        <div className="soldProducts__line" />
        <span>
          {isCollectionSelection ? "V rámci kolekce" : "Výběr z ateliéru"}
        </span>
      </div>

      <div className="soldProducts__intro">
        <h2 id="next-objects-title">
          Další objekty,
          <em> každý s vlastním příběhem.</em>
        </h2>
        <p>
          {isCollectionSelection
            ? "Pokračujte mezi originály ze stejné kolekce."
            : "Pokračujte mezi dalšími originály z ateliéru."}{" "}
          Každý vzniká pomalu, ručně a v malém počtu.
        </p>
      </div>

      <ProductRail products={products} />

      <div className="soldProducts__foot" aria-hidden="true">
        <span>Posuňte nebo pokračujte stránkou</span>
        <div />
        <span>Výběr z ateliéru</span>
      </div>
    </section>
  )
}
