"use client"

import { getProductPrice } from "@lib/util/get-product-price"
import type { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { motion, type Variants } from "framer-motion"
import Image from "next/image"
import { useState } from "react"
import styles from "./style.module.scss"

type ProductCardProps = {
  product: HttpTypes.StoreProduct
  priority?: boolean
}

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

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const [isInteracting, setIsInteracting] = useState(false)
  const { cheapestPrice } = getProductPrice({ product })
  const primaryImage = product.thumbnail || product.images?.[0]?.url || "/assets/img/horizontal_prop.png"
  const secondaryImage = product.images?.find(
    (image) => image.url && image.url !== primaryImage
  )?.url
  const isNew = Boolean(product.created_at && new Date(product.created_at).getTime() > Date.now() - 30 * 86400000)
  const hasSale = Boolean(cheapestPrice?.price_type === "sale" && cheapestPrice.percentage_diff)
  const interactionState = isInteracting ? "hover" : "initial"

  return (
    <motion.article
      className={styles.root}
      layout="position"
      data-interacting={isInteracting || undefined}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsInteracting(false)
        }
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: .6, ease: [0.76, 0, 0.24, 1] }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.25 } }}
    >
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className={styles.link}
      >
        <div className={styles.visual}>
          <div className={styles.primary}>
            <Image
              src={primaryImage}
              alt={product.title || "Keramický objekt"}
              fill
              priority={priority}
              quality={80}
              sizes="(min-width: 1520px) 20vw, (min-width: 1101px) 28vw, (min-width: 701px) 46vw, 94vw"
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
                  quality={74}
                  sizes="(min-width: 1520px) 20vw, (min-width: 1101px) 28vw, (min-width: 701px) 46vw, 94vw"
                />
              </motion.div>
          )}
          <div className={styles.badges}>
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
            <span className={styles.discoverLabel}>Detail objektu</span>
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
            <p className={styles.description}>{product.subtitle || product.description || "Ručně vytvořený originál z ateliéru Lucie Polanské."}</p>
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
