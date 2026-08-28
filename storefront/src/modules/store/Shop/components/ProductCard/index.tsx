"use client"

import { getProductPrice } from "@lib/util/get-product-price"
import type { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { motion, type Variants } from "framer-motion"
import Image from "next/image"
import { memo, useCallback, useMemo, useState } from "react"
import styles from "./style.module.scss"
import { availabilityLabel, productAvailability } from "@lib/util/availability"
import { easeReveal } from "@lib/motion-tokens"

type ProductCardProps = {
  product: HttpTypes.StoreProduct
  priority?: boolean
}

/** A card is rendered once per product in the grid, so every object here is hoisted: an inline
    literal would allocate — and make framer-motion re-diff the animation — once per card, per
    render of the grid. Identical values to before; only their lifetime changed. */
const cardInitial = { opacity: 0, y: 24 }
const cardInView = { opacity: 1, y: 0 }
const cardViewport = { once: true, margin: "-8%" } as const
const cardTransition = { duration: 0.6, ease: easeReveal }
const cardExit = { opacity: 0, scale: 0.985, transition: { duration: 0.25 } }

const NEW_FOR_MS = 30 * 86400000

const IMAGE_SIZES =
  "(min-width: 1520px) 20vw, (min-width: 1101px) 28vw, (min-width: 701px) 46vw, 94vw"

const imageAnim: Variants = {
  initial: {
    opacity: 0,
    scale: 1.045,
    filter: "blur(4px)",
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 1, 1],
    },
  },
  hover: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.62,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

const buttonAnim: Variants = {
  initial: {
    opacity: 0,
    clipPath: "inset(0px 0px 0px 102px)",
    x: 6,
    transition: {
      opacity: { duration: 0.14, ease: "easeOut" },
      clipPath: { duration: 0.28, ease: [0.76, 0, 0.24, 1] },
      x: { duration: 0.24, ease: [0.76, 0, 0.24, 1] },
    },
  },
  hover: {
    opacity: 1,
    clipPath: "inset(0px 0px 0px 0px)",
    x: 0,
    transition: {
      opacity: { delay: 0.18, duration: 0.24, ease: "easeOut" },
      clipPath: {
        delay: 0.18,
        duration: 0.62,
        ease: [0.16, 1, 0.3, 1],
      },
      x: { delay: 0.18, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    },
  },
}

function ProductCard({ product, priority = false }: ProductCardProps) {
  const [isInteracting, setIsInteracting] = useState(false)

  /* Hovering flips `isInteracting`, which re-renders the card. Deriving price, availability and
     the image pair cost that work again on every pointer in/out; they depend only on the product,
     so they are computed once instead. */
  const { cheapestPrice, primaryImage, secondaryImage, isNew, hasSale, availability } =
    useMemo(() => {
      const { cheapestPrice } = getProductPrice({ product })
      const primaryImage =
        product.thumbnail || product.images?.[0]?.url || "/assets/img/horizontal_prop.png"

      return {
        cheapestPrice,
        primaryImage,
        secondaryImage: product.images?.find(
          (image) => image.url && image.url !== primaryImage
        )?.url,
        isNew: Boolean(
          product.created_at &&
            new Date(product.created_at).getTime() > Date.now() - NEW_FOR_MS
        ),
        hasSale: Boolean(
          cheapestPrice?.price_type === "sale" && cheapestPrice.percentage_diff
        ),
        availability: productAvailability(product),
      }
    }, [product])

  const startInteracting = useCallback(() => setIsInteracting(true), [])
  const stopInteracting = useCallback(() => setIsInteracting(false), [])
  const handleBlurCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsInteracting(false)
    }
  }, [])

  const interactionState = isInteracting ? "hover" : "initial"

  return (
    <motion.article
      className={styles.root}
      layout="position"
      data-interacting={isInteracting || undefined}
      onMouseEnter={startInteracting}
      onMouseLeave={stopInteracting}
      onFocusCapture={startInteracting}
      onBlurCapture={handleBlurCapture}
      initial={cardInitial}
      whileInView={cardInView}
      viewport={cardViewport}
      transition={cardTransition}
      exit={cardExit}
    >
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className={styles.link}
      >
        <div className={styles.visual}>
          <div className={styles.primary}>
            <Image
              src={primaryImage}
              alt={product.title || "Keramický výrobek"}
              fill
              priority={priority}
              quality={100}
              sizes={IMAGE_SIZES}
            />
          </div>
          {secondaryImage && (
              <motion.div
                className={styles.secondary}
                initial="initial"
                animate={interactionState}
                variants={imageAnim}
                aria-hidden="true"
              >
                <Image
                  src={secondaryImage}
                  alt=""
                  fill
                  loading="lazy"
                  quality={100}
                  sizes={IMAGE_SIZES}
                />
              </motion.div>
          )}
          <div className={styles.badges}>
            {/* A customer could fall in love with a sold piece and only learn at the PDP. */}
            {availability === "sold-out" && (
              <span className={styles.badgeSold}>{availabilityLabel["sold-out"]}</span>
            )}
            {availability === "last-one" && (
              <span className={styles.badgeLast}>{availabilityLabel["last-one"]}</span>
            )}
            {/* Buyable, but not from a shelf — the wait is spelled out on the
                product page. Saying it here too stops the grid from reading as
                „ready to ship" for a piece that still has to be made. */}
            {availability === "made-to-order" && (
              <span className={styles.badgeMade}>
                {availabilityLabel["made-to-order"]}
              </span>
            )}
            {isNew && <span>Novinka</span>}
            {hasSale && <span>−{Math.round(Number(cheapestPrice!.percentage_diff))} %</span>}
          </div>
          <motion.span
            className={styles.discover}
            initial="initial"
            animate={interactionState}
            data-interacting={isInteracting || undefined}
            variants={buttonAnim}
            aria-hidden="true"
          >
            <span className={styles.discoverBackground} />
            <span className={styles.discoverLabel}>Zobrazit detail</span>
            <i>→</i>
          </motion.span>
        </div>

        <div className={styles.meta}>
          <div className={styles.heading}>
            <div>
              <p>{product.type?.value || product.categories?.[0]?.name || "Autorská keramika"}</p>
              <h3>{product.title}</h3>
            </div>
            <span className={styles.index} aria-hidden="true">LP</span>
          </div>
          <div className={styles.bottom}>
            <p className={styles.description}>{product.subtitle || product.description || "Ručně vyrobený originál z píseckého ateliéru."}</p>
            <div className={styles.price}>
              {hasSale && <del>{cheapestPrice?.original_price}</del>}
              <strong>{cheapestPrice?.calculated_price || "Cena na dotaz"}</strong>
            </div>
          </div>
        </div>
      </LocalizedClientLink>
    </motion.article>
  )
}

/* The grid re-renders on every filter change, load-more and refresh tick. Without this, each of
   those re-rendered all N cards even though their props were unchanged. */
export default memo(ProductCard)
