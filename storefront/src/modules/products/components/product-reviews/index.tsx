"use client"

// Using local API to aggregate public approved reviews with user's own pending ones for the product
import { Star, StarSolid } from "@medusajs/icons"
import { StoreProductReview } from "../../../../types/global"
// import { Button } from "@medusajs/ui"
import { useState, useEffect } from "react"
import ProductReviewsForm from "./form"
import styles from "./style.module.scss"

import { motion } from 'framer-motion';
import { useFormStatus } from 'react-dom';

type ProductReviewsProps = {
  productId: string
  initialReviews: StoreProductReview[]
  initialRating: number
  initialCount: number
}

export default function ProductReviews({
  productId,
  initialReviews,
  initialRating,
  initialCount,
}: ProductReviewsProps) {
  const [page, setPage] = useState(1)
  const defaultLimit = 10
  const [reviews, setReviews] = useState<StoreProductReview[]>(initialReviews)
  const [rating, setRating] = useState(initialRating)
  const [hasMoreReviews, setHasMoreReviews] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)

  // Mount debug to verify hydration
  useEffect(() => {
    console.log("[ProductReviews] mounted", { productId, initialCount, initialRating })
  }, [])

  //WIP: Test and correct if needed - there is/was error on local hosting

  useEffect(() => {
    console.log("Fetching reviews for product:", productId, "Page:", page)
    fetch(`/api/product-reviews/${productId}?limit=${defaultLimit}&offset=${(page - 1) * defaultLimit}`, {
      method: "GET",
      cache: "no-store",
    })
    .then((r) => r.json())
    .then(({ reviews, average_rating, count, limit }) => {
      console.log("CLIENT got reviews:", reviews, average_rating, count, limit)
      const incoming = Array.isArray(reviews) ? reviews : []
      const safeIncoming = incoming.filter(
        (r): r is StoreProductReview => !!r && typeof r.id === "string"
      )

      setReviews((prev) => {
        const newReviews = safeIncoming.filter(
          (review) => !prev.some((r) => r.id === review.id)
        )
        return [...prev, ...newReviews]
      })
      setRating(Math.round(average_rating || 0))
      console.log("Reviews after filtering:", safeIncoming)
      console.log("Count:", count, limit, page, count > (limit || 0) * page)
      setHasMoreReviews(!!(count && limit && count > limit * page))
      setCount(count)
    })
    .catch((e) => {
      console.error("[ProductReviews] fetch failed", e)
      setError(e?.message || "Chyba při načítání recenzí")
    })
  }, [page])

  // Refetch first page when productId changes (navigating between products client-side)
  useEffect(() => {
    setPage(1)
    setReviews(initialReviews)
    setRating(initialRating)
    setCount(initialCount)
  }, [productId])


  console.log("ProductReviews", { productId, page, reviews, rating, hasMoreReviews, count })
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log(
        localStorage.getItem("medusa_jwt") || localStorage.getItem("token")
      )
    }
  }, [])
  

  function Review({ review }: { review: StoreProductReview }) {
    return (
      <div key={review?.id ?? Math.random()} className={styles.review}>
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
        <div>{review?.content ?? ""}</div>
        <div className={styles.reviewFooter}>
          {(review?.first_name ?? "")} {(review?.last_name ?? "")}
        </div>
      </div>
    )
  }

  return (
    <div className={`product-page-constraint ${styles.container}`}>
      <div className={styles.reviews}>
        <div className={styles.header}>
        <p className={styles.title}>
          Recenze
        </p>
        {error && (
          <p className={styles.error} style={{ color: "#c00" }}>
            Nepodařilo se načíst recenze: {error}
          </p>
        )}
        <div className={styles.starsAndCount}>
            <div className={styles.stars}>
            {Array.from({ length: 5 }).map((_, index) => (
                <span key={index}>
                {!rating || index > rating ? (
                    <Star />
                ) : (
                    <StarSolid className="text-ui-tag-orange-icon" />
                )}
                </span>
            ))}
            </div>
            <span className={styles.count}>
            {count} {count === 1 ? "recenze" : "recenzí"}
            </span>
        </div>
        </div>

        <div className={styles.reviewsGrid}>
          {reviews
            .filter((r): r is StoreProductReview => !!r)
            .map((review) => (
              <Review key={review.id} review={review} />
            ))}
        </div>

        {hasMoreReviews && (
          <div className="flex justify-center mt-8">
            <ClickButton
              text="Načíst další recenze"
              onClickAction={() => setPage(page + 1)}
              type="button"
              className={styles.loadMoreButton}
            />
          </div>
        )}
      </div>

      <ProductReviewsForm productId={productId} />
    </div>
  )
}


type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    "data-testid"?: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
function ClickButton({ onClickAction, ClickAction, disabled = false, text, type = "button", className, "data-testid": dataTestId }: ClickButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    const { pending } = useFormStatus();
    const isSubmitting = type === "submit" ? pending : false;
    const isDisabled = disabled || isSubmitting;
    const handleClick = onClickAction ?? ClickAction;

    return (
        <div className={className ? `${styles.ClickButton} ${className}` : styles.ClickButton}>
            <button 
                type={type}
                className={styles.button}
                onClick={handleClick}
                disabled={isDisabled}
                aria-busy={isDisabled || undefined}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                data-testid={dataTestId}
            >
                <motion.div
                    className={styles.slider}
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div 
                        className={styles.el}
                        style={{ backgroundColor: "var(--bgPrimary)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className={styles.el}
                        style={{ backgroundColor: "var(--bgBlack)" }}
                    >
                        <PerspectiveText label={text} />
                    </div>
                </motion.div>
            </button>
        </div>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={styles.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}