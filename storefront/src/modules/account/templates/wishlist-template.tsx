"use client"

import { motion } from "framer-motion"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import DeleteButton from "../components/delete-button/DeleteButton"
import ShareButton from "../components/share-button/ShareButton"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "../components/account-page-reveal"
import { accountListItemVariants, accountListVariants } from "../motion"
import s from "./styles/wishlist-template.module.scss"
import AccountInteractiveSurface from "../components/account-interactive-surface"

function getVariantOptionsSummary(variant: any): string {
  if (!variant) return ""
  const values = Array.isArray(variant.options)
    ? variant.options.map((option: any) => option?.value).filter(Boolean)
    : []
  return values.length ? values.join(" / ") : variant.title || ""
}

type WishlistTemplateProps = {
  items: any[]
  countryCode: string
  isPreview?: boolean
}

export default function WishlistTemplate({
  items,
  isPreview = false,
}: WishlistTemplateProps) {
  return (
    <AccountPageReveal
      className={s.accountWishlistRoot}
      data-testid="wishlist-page-wrapper"
    >
      <AccountSectionReveal className={s.accountWishlistHeader}>
        <p>Soukromý archiv · uložené</p>
        <div className={s.accountWishlistHeading}>
          <h1>
            Oblíbené
            <em>objekty.</em>
          </h1>
          <span>{String(items.length).padStart(2, "0")} uložených</span>
        </div>
        <div className={s.accountWishlistIntro}>
          <p>
            Osobní výběr objektů, ke kterým se můžete vrátit, až přijde jejich
            čas.
          </p>
          {items.length > 0 && !isPreview && (
            <ShareButton data-testid="share-button" />
          )}
        </div>
      </AccountSectionReveal>

      <AccountSectionReveal className={s.accountWishlistBody}>
        {isPreview && (
          <div className={s.accountPreviewNotice}>
            <span>Vývojový náhled</span>
            <p>
              Ukázkové položky se zobrazují jen lokálně, dokud seznam přání
              neobsahuje vlastní objekty.
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <div className={s.accountWishlistEmpty}>
            <div>
              <span>Výběr je zatím prázdný</span>
              <p>Až vás některý objekt osloví, uložte si jej záložkou.</p>
            </div>
            <PremiumActionLink
              href="/store"
              text="Objevovat objekty"
              className={s.accountWishlistAction}
            />
          </div>
        ) : (
          <motion.ul
            className={s.accountWishlistGrid}
            variants={accountListVariants}
            initial="hidden"
            animate="visible"
          >
            {items.map((item: any, index: number) => {
              const variant = item?.product_variant
              const product = variant?.product
              const title =
                product?.title || variant?.title || "Ateliérový objekt"
              const subtitle = getVariantOptionsSummary(variant)
              const href = product?.handle
                ? `/products/${product.handle}`
                : "/store"
              const image =
                product?.thumbnail || "/assets/img/horizontal_prop.png"

              return (
                <motion.li
                  key={item.id}
                  className={s.accountWishlistCard}
                  variants={accountListItemVariants}
                >
                  <AccountInteractiveSurface
                    className={s.accountWishlistSurface}
                    contentClassName={s.accountWishlistSurfaceContent}
                  >
                    <LocalizedClientLink
                      className={s.accountWishlistProduct}
                      href={href}
                    >
                      <div className={s.accountWishlistImage}>
                        <Image
                          src={image}
                          alt={title}
                          width={520}
                          height={640}
                        />
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        {isPreview && <i>Náhled</i>}
                      </div>
                    </LocalizedClientLink>
                    <div className={s.accountWishlistCardFooter}>
                      <LocalizedClientLink
                        className={s.accountWishlistInfo}
                        href={href}
                      >
                        <span>Ateliérový objekt</span>
                        <h2>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                      </LocalizedClientLink>
                      {!isPreview && (
                        <div className={s.accountWishlistCardAction}>
                          <DeleteButton itemId={item.id} />
                        </div>
                      )}
                    </div>
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
