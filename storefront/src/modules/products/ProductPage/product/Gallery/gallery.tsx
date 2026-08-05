"use client"

import { HttpTypes } from "@medusajs/types"
import { BundleProduct } from "@lib/data/products"
import { motion } from "framer-motion"
import Image from "next/image"
import { useMemo } from "react"

import { easeMicro } from "@lib/motion-tokens"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  bundle?: BundleProduct
}

/* Every one of these was an inline literal re-allocated on each render of the gallery — and
   the media list re-renders whenever the surrounding product page does. Same values, one copy. */
const frameInitial = { opacity: 0.35, clipPath: "inset(7% 0 7% 0)" }
const frameInView = { opacity: 1, clipPath: "inset(0% 0 0% 0)" }
const frameViewport = { amount: 0.28 } as const
const frameViewportInset = { amount: 0.28, margin: "-8% 0px -8% 0px" } as const
const frameTransition = { duration: 0.9, ease: easeMicro }

const mediaInitial = { scale: 1.045, y: 16 }
const mediaInView = { scale: 1, y: 0 }
const mediaViewport = { amount: 0.3 } as const
const mediaTransition = { duration: 1.1, ease: easeMicro }

const tileViewport = { amount: 0.4 } as const

const captionInitial = { opacity: 0, y: 10 }
const captionInView = { opacity: 1, y: 0 }
const captionViewport = { once: true, amount: 0.7 } as const
const captionTransition = { duration: 0.75, ease: easeMicro }

const ruleInitial = { scaleX: 0.08 }
const ruleInView = { scaleX: 1 }
const ruleTransition = { duration: 1, delay: 0.12, ease: easeMicro }

const captions = [
  ["Celý objekt", "Tvar a proporce"],
  ["Detail povrchu", "Stopa ruky"],
  ["V prostoru", "Měřítko a světlo"],
  ["Zblízka", "Glazura a materiál"],
  ["Připraveno pro vás", "Každý kus je originál"],
]

const Gallery: React.FC<ProductTemplateProps> = ({ product, bundle }) => {
  const images = useMemo(
    () => (product.images ?? []).filter((image) => Boolean(image.url)),
    [product.images]
  )
  const bundleImages = useMemo(
    () =>
      (bundle?.items ?? [])
        .map((item) => ({
          id: item.id,
          title: item.product.title,
          url: item.product.thumbnail || item.product.images?.[0]?.url,
        }))
        .filter((item): item is { id: string; title: string; url: string } =>
          Boolean(item.url)
        ),
    [bundle]
  )

  /* The bundle tiles stagger by index, so their motion objects cannot be module constants —
     but they only change when the tile count does, not on every render. */
  const tileMotion = useMemo(
    () =>
      bundleImages.map((_, index) => ({
        initial: { opacity: 0, y: 24 + index * 8, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.8, delay: 0.12 + index * 0.1, ease: easeMicro },
      })),
    [bundleImages]
  )
  const galleryImages = useMemo(() => {
    if (!bundle) {
      return images.map((image, index) => ({
        key: image.id || image.url || `product-image-${index}`,
        url: image.url!,
        productTitle: product.title,
        viewIndex: index,
      }))
    }

    return bundle.items.flatMap((item) => {
      const itemImages = (item.product.images ?? []).filter((image) =>
        Boolean(image.url)
      )
      const sources = itemImages.length
        ? itemImages
        : item.product.thumbnail
        ? [{ id: `${item.id}-thumbnail`, url: item.product.thumbnail }]
        : []

      return sources.map((image, viewIndex) => ({
        key: `${item.id}-${image.id || image.url || viewIndex}`,
        url: image.url!,
        productTitle: item.product.title,
        viewIndex,
      }))
    })
  }, [bundle, images, product.title])

  if (!galleryImages.length && !bundleImages.length) {
    return <div className="product__mediaEmpty">Fotografie připravujeme.</div>
  }

  const galleryCount = galleryImages.length + (bundleImages.length ? 1 : 0)

  return (
    <div className="product__gallery">
      <div className="product__galleryIntro">
        <span>{bundle ? "Soubor v detailu" : "Objekt v detailu"}</span>
        <span>{String(galleryCount).padStart(2, "0")} pohledů</span>
      </div>

      {bundleImages.length > 0 && (
        <motion.figure
          className="product__mediaFrame product__bundleFrame"
          initial={frameInitial}
          whileInView={frameInView}
          viewport={frameViewport}
          transition={frameTransition}
        >
          <div className="product__bundleComposition">
            {bundleImages.map((item, index) => (
              <motion.div
                key={item.id}
                className="product__bundleObject"
                data-index={index}
                initial={tileMotion[index].initial}
                whileInView={tileMotion[index].animate}
                viewport={tileViewport}
                transition={tileMotion[index].transition}
              >
                <Image
                  src={item.url}
                  alt={item.title}
                  fill
                  sizes="(max-width: 900px) 38vw, 20vw"
                  quality={90}
                  className="product__bundleAsset"
                  priority={index === 0}
                />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </motion.div>
            ))}
          </div>
          <figcaption>
            <span>01 · Celý soubor</span>
            <span>{bundle?.title}</span>
          </figcaption>
        </motion.figure>
      )}

      {galleryImages.map((image, index) => {
        const caption = captions[image.viewIndex % captions.length]
        const displayIndex = index + (bundleImages.length ? 2 : 1)
        return (
          <motion.figure
            key={image.key}
            className="product__mediaFrame"
            initial={frameInitial}
            whileInView={frameInView}
            viewport={frameViewportInset}
            transition={frameTransition}
          >
            <motion.div
              className="product__mediaImage"
              initial={mediaInitial}
              whileInView={mediaInView}
              viewport={mediaViewport}
              transition={mediaTransition}
            >
              <Image
                src={image.url}
                alt={`${image.productTitle} – ${caption[0].toLowerCase()}`}
                fill
                sizes="(max-width: 900px) 100vw, 52vw"
                quality={90}
                className="product__mediaAsset"
                priority={index === 0}
              />
            </motion.div>
            <figcaption>
              <span>
                {String(displayIndex).padStart(2, "0")} · {image.productTitle}
              </span>
              <span>
                {String(image.viewIndex + 1).padStart(2, "0")} · {caption[1]}
              </span>
            </figcaption>
          </motion.figure>
        )
      })}

      <div className="product__galleryOutro">
        <span>Každý objekt nese drobnou odchylku.</span>
        <p>Právě v ní zůstává viditelná práce rukou.</p>

        <motion.div
          className="product__galleryOutroGraphic"
          aria-hidden="true"
          initial={captionInitial}
          whileInView={captionInView}
          viewport={captionViewport}
          transition={captionTransition}
        >
          <span>01 · stopa ruky</span>
          <motion.i
            initial={ruleInitial}
            whileInView={ruleInView}
            viewport={captionViewport}
            transition={ruleTransition}
          />
          <b>
            <em />
          </b>
          <motion.i
            initial={ruleInitial}
            whileInView={ruleInView}
            viewport={captionViewport}
            transition={ruleTransition}
          />
          <span>pokračovat · 02</span>
        </motion.div>
      </div>
    </div>
  )
}

export default Gallery
