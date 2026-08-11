"use client"

import { Star, StarSolid } from "@medusajs/icons"
import { motion } from "framer-motion"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "../components/account-page-reveal"
import { accountListItemVariants, accountListVariants } from "../motion"
import s from "./styles/reviews-template.module.scss"
import AccountInteractiveSurface from "../components/account-interactive-surface"

type ReviewsTemplateProps = {
  reviews: any[]
  isPreview?: boolean
}

const formatReviewDate = (value?: string) => {
  if (!value) return null

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

export default function ReviewsTemplate({
  reviews,
  isPreview = false,
}: ReviewsTemplateProps) {
  const visibleReviews = reviews?.filter(Boolean) || []

  return (
    <AccountPageReveal
      className={s.accountReviewsRoot}
      data-testid="reviews-page-wrapper"
    >
      <AccountSectionReveal className={s.accountReviewsHeader}>
        <p>Váš účet · recenze</p>
        <div className={s.accountReviewsHeading}>
          <h1>
            Vaše
            <em>zkušenosti.</em>
          </h1>
          <span>{String(visibleReviews.length).padStart(2, "0")} recenzí</span>
        </div>
        <p className={s.accountReviewsDescription}>
          Co jste napsali o věcech, které už máte doma. Ostatním to hodně
          pomáhá při výběru.
        </p>
      </AccountSectionReveal>

      <AccountSectionReveal className={s.accountReviewsBody}>
        {isPreview && (
          <div className={s.accountPreviewNotice}>
            <span>Vývojový náhled</span>
            <p>
              Tohle jsou jen ukázky. Zmizí, jakmile napíšete první vlastní recenzi.
            </p>
          </div>
        )}

        {!visibleReviews.length ? (
          <div className={s.accountReviewsEmpty}>
            <div>
              <span>Zatím tu nic není</span>
              <p>Recenzi napíšete u výrobku, který už máte doma.</p>
            </div>
            <PremiumActionLink
              href="/store"
              text="Do obchodu"
              className={s.accountReviewsAction}
            />
          </div>
        ) : (
          <motion.ul
            className={s.accountReviewsList}
            variants={accountListVariants}
            initial="hidden"
            animate="visible"
          >
            {visibleReviews.map((review: any, index: number) => {
              const product = review?.product
              const href = product?.handle
                ? `/products/${product.handle}`
                : "/store"
              const image =
                (typeof product?.thumbnail === "string"
                  ? product.thumbnail
                  : product?.thumbnail?.url) ||
                "/assets/img/horizontal_prop.png"

              return (
                <motion.li
                  key={review.id}
                  className={s.accountReviewCard}
                  variants={accountListItemVariants}
                >
                  <AccountInteractiveSurface
                    className={s.accountReviewSurface}
                    contentClassName={s.accountReviewSurfaceContent}
                  >
                    <LocalizedClientLink href={href}>
                      <span className={s.accountReviewIndex}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className={s.accountReviewCopy}>
                        <span className={s.accountReviewProduct}>
                          {product?.title || "Z ateliéru"}
                        </span>
                        <h2>{review?.title || "Vaše zkušenost"}</h2>
                        <p>{review?.content || "Bez textu."}</p>
                        <div className={s.accountReviewFooter}>
                          <div
                            className={s.accountReviewStars}
                            aria-label={`${review?.rating ?? 0} z 5 hvězd`}
                          >
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <span key={starIndex}>
                                {starIndex < (review?.rating ?? 0) ? (
                                  <StarSolid />
                                ) : (
                                  <Star />
                                )}
                              </span>
                            ))}
                          </div>
                          {formatReviewDate(review?.created_at) && (
                            <time dateTime={review.created_at}>
                              {formatReviewDate(review.created_at)}
                            </time>
                          )}
                        </div>
                      </div>
                      <div className={s.accountReviewImage}>
                        <Image
                          src={image}
                          alt={product?.title || "Výrobek z recenze"}
                          width={260}
                          height={320}
                        />
                      </div>
                      <i aria-hidden="true">↗</i>
                    </LocalizedClientLink>
                  </AccountInteractiveSurface>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}
