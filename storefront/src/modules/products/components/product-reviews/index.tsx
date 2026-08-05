"use client"

// Using local API to aggregate public approved reviews with user's own pending ones for the product
import { Star, StarSolid } from "@medusajs/icons"
import { StoreProductReview } from "../../../../types/global"
// import { Button } from "@medusajs/ui"
import { useState, useEffect } from "react"
import ProductReviewsForm from "./form"
import styles from "./style.module.scss"

import { motion } from "framer-motion"
import { withCount } from "@lib/util/plurals"

type ProductReviewsProps = {
  productId: string
  initialReviews: StoreProductReview[]
  initialRating: number
  initialCount: number
}

/*
 * VISUAL TESTING ONLY:
 * Re-enable this static review template if the product review component needs
 * further visual testing without review records from the backend.
 *
const REVIEW_DESIGN_PREVIEW = true

const previewReviews: StoreProductReview[] = [
  {
    id: "preview-review-01",
    title: "Ještě krásnější než na fotografii",
    rating: 5,
    content:
      "Objekt má své místo u vstupu do zahrady. Každý den vypadá trochu jinak podle světla a přesně to na ruční práci miluji.",
    first_name: "Jana",
    last_name: "K.",
  },
  {
    id: "preview-review-02",
    title: "Kousek s opravdovým charakterem",
    rating: 5,
    content:
      "Povrch, barva i drobné nepravidelnosti působí velmi přirozeně. Balíček dorazil pečlivě zabalený a objekt dělá radost celé rodině.",
    first_name: "Petra",
    last_name: "M.",
  },
  {
    id: "preview-review-03",
    title: "Radost, která zůstává",
    rating: 5,
    content:
      "Byl to dárek, ale nakonec jsme si objednali další i pro sebe. Je poznat, že každý kus prošel rukama a není jen kopií.",
    first_name: "Alena",
    last_name: "S.",
  },
  {
    id: "preview-review-04",
    title: "Jemný detail zahrady",
    rating: 5,
    content:
      "Keramika působí klidně a přirozeně, ale přitom si jí návštěvy vždy všimnou. Oceňuji hlavně povrch a citlivě zvolenou barevnost.",
    first_name: "Marie",
    last_name: "H.",
  },
  {
    id: "preview-review-05",
    title: "Poctivě vytvořený originál",
    rating: 5,
    content:
      "Naživo je krásně vidět práce rukou a drobné odlišnosti materiálu. Přesně takový osobní objekt jsme do našeho prostoru hledali.",
    first_name: "Eva",
    last_name: "P.",
  },
  {
    id: "preview-review-06",
    title: "Bezpečně až k nám domů",
    rating: 5,
    content:
      "Měla jsem obavu z dopravy, ale objekt dorazil opravdu pečlivě zabalený. Komunikace i celý zážitek z objednávky byly výborné.",
    first_name: "Hana",
    last_name: "R.",
  },
  {
    id: "preview-review-07",
    title: "Dárek s vlastním příběhem",
    rating: 5,
    content:
      "Vybrali jsme jej jako výroční dárek a měl velký úspěch. Není to jen dekorace, ale věc, ke které si člověk vytvoří vztah.",
    first_name: "Klára",
    last_name: "D.",
  },
  {
    id: "preview-review-08",
    title: "Krása v každém světle",
    rating: 5,
    content:
      "Během dne se mění podle světla a okolní zeleně. I po několika měsících mě stále baví objevovat nové drobné detaily.",
    first_name: "Lenka",
    last_name: "V.",
  },
]
*/

export default function ProductReviews({
  productId,
  initialReviews,
  initialRating,
  initialCount,
}: ProductReviewsProps) {
  const pageSize = 4
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [reviews, setReviews] = useState<StoreProductReview[]>(initialReviews)
  const [rating, setRating] = useState(initialRating)
  const [hasMoreReviews, setHasMoreReviews] = useState(
    initialCount > initialReviews.length
  )
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)
  const displayedReviews = reviews
  const displayedRating = rating
  const displayedCount = count

  /*
   * VISUAL TESTING ONLY:
   * Replace the three assignments above with this fallback if the component
   * needs further visual testing without backend reviews.
   *
  const displayedReviews =
    reviews.length > 0
      ? reviews
      : REVIEW_DESIGN_PREVIEW
      ? previewReviews
      : reviews
  const displayedRating =
    reviews.length > 0 ? rating : REVIEW_DESIGN_PREVIEW ? 5 : rating
  const displayedCount =
    reviews.length > 0
      ? count
      : REVIEW_DESIGN_PREVIEW
      ? previewReviews.length
      : count
  */

  // Refetch first page when productId changes (navigating between products client-side)
  useEffect(() => {
    setReviews(initialReviews)
    setRating(initialRating)
    setCount(initialCount)
    setVisibleCount(pageSize)
    setHasMoreReviews(initialCount > initialReviews.length)
    setError(null)
  }, [productId, initialReviews, initialRating, initialCount])

  const visibleReviews = displayedReviews
    .filter((review): review is StoreProductReview => !!review)
    .slice(0, visibleCount)
  const canRevealLocalReviews = visibleCount < displayedReviews.length
  const canShowMoreReviews = canRevealLocalReviews || hasMoreReviews

  const showMoreReviews = async () => {
    if (canRevealLocalReviews) {
      setVisibleCount((current) => current + pageSize)
      return
    }

    setIsLoadingMore(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/product-reviews/${productId}?limit=${pageSize}&offset=${reviews.length}`,
        { method: "GET", cache: "no-store" }
      )

      if (!response.ok) {
        throw new Error("Chyba při načítání recenzí")
      }

      const payload = await response.json()
      const incoming: unknown[] = Array.isArray(payload.reviews)
        ? payload.reviews
        : []
      const safeIncoming = incoming.filter(
        (review): review is StoreProductReview => {
          if (!review || typeof review !== "object") {
            return false
          }

          return (
            "id" in review &&
            typeof (review as { id?: unknown }).id === "string"
          )
        }
      )
      const newReviews = safeIncoming.filter(
        (review) => !reviews.some((current) => current.id === review.id)
      )
      const nextCount = Number(payload.count) || count
      const totalLoaded = reviews.length + newReviews.length

      setReviews((current) => [...current, ...newReviews])
      setRating(Math.round(payload.average_rating || rating))
      setCount(nextCount)
      setVisibleCount((current) => current + pageSize)
      setHasMoreReviews(totalLoaded < nextCount)
    } catch (loadError) {
      console.error("[ProductReviews] fetch failed", loadError)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Chyba při načítání recenzí"
      )
    } finally {
      setIsLoadingMore(false)
    }
  }

  function Review({
    review,
    index,
  }: {
    review: StoreProductReview
    index: number
  }) {
    return (
      <motion.article
        className={styles.review}
        initial={initial}
        whileInView={whileInView}
        viewport={viewport}
        transition={{
          duration: 0.7,
          delay: index * 0.08,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className={styles.reviewMeta}>
          <span>{String(index + 1).padStart(2, "0")} · zkušenost</span>
          <span>ověřený objekt</span>
        </div>
        <div className={styles.reviewHeader}>
          {review?.title ? <strong>{review.title}</strong> : null}
          <div className={styles.reviewStars}>
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index}>
                {review && index < (review.rating ?? 0) ? (
                  <StarSolid className="text-ui-tag-orange-icon" />
                ) : (
                  <Star />
                )}
              </span>
            ))}
          </div>
        </div>
        <p className={styles.reviewContent}>{review?.content ?? ""}</p>
        <div className={styles.reviewFooter}>
          <span>
            {review?.first_name ?? ""} {review?.last_name ?? ""}
          </span>
          <i />
        </div>
      </motion.article>
    )
  }

  // "0 recenzí" plus five empty stars on every new product undermines a shop where most pieces
  // are new (spec §4). The section appears once it has something to show; customers who want to
  // write the first one still reach the form from their account after ordering.
  if (!displayedCount && !isLoadingMore && !error) {
    return null
  }

  return (
    <div
      id="product-reviews"
      className={`product-page-constraint ${styles.container}`}
      data-scroll-section
      data-scroll-label="Recenze"
    >
      <div className={styles.reviews}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <span>03 · zkušenosti</span>
            <p className={styles.title}>Recenze</p>
          </div>
          {error && (
            <p className={styles.error}>
              Nepodařilo se načíst recenze: {error}
            </p>
          )}
          <div className={styles.starsAndCount}>
            <div className={styles.stars}>
              {Array.from({ length: 5 }).map((_, index) => (
                <span key={index}>
                  {!displayedRating || index >= displayedRating ? (
                    <Star />
                  ) : (
                    <StarSolid className="text-ui-tag-orange-icon" />
                  )}
                </span>
              ))}
            </div>
            <span className={styles.count}>
              {withCount(displayedCount, "recenze", "recenze", "recenzí")}
            </span>
          </div>
        </div>

        <div className={styles.reviewsGrid}>
          {visibleReviews.map((review, index) => (
            <Review key={review.id} review={review} index={index} />
          ))}
        </div>

        {canShowMoreReviews && (
          <div className={styles.reviewPagination}>
            <div className={styles.reviewProgress}>
              <i
                style={{
                  width: `${Math.min(
                    100,
                    (visibleReviews.length / Math.max(displayedCount, 1)) * 100
                  )}%`,
                }}
              />
            </div>
            <p>{`Zobrazeno ${visibleReviews.length} z ${withCount(displayedCount, "recenze", "recenze", "recenzí")}`}</p>
            <button
              type="button"
              onClick={showMoreReviews}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Načítám…" : "Objevit další recenze"}
              <span>↓</span>
            </button>
          </div>
        )}
      </div>

      <ProductReviewsForm productId={productId} previewMode={false} />
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, y: 18 }
const whileInView = { opacity: 1, y: 0 }
const viewport = { once: true, amount: 0.45 }
