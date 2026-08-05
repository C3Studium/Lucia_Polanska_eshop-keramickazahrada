"use client"

import { Badge, Heading, Input, Label, Text } from "@medusajs/ui"
import React, { useActionState } from "react"

import { applyPromotions, submitPromotionForm } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import ErrorMessage from "../error-message"
import { AnimatePresence, motion } from "framer-motion"

import styles from "./style.module.scss"

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
  const [isOpen, setIsOpen] = React.useState(false)

  const { items = [], promotions = [] } = cart
  const removePromotionCode = async (code: string) => {
    const validPromotions = promotions.filter(
      (promotion) => promotion.code !== code
    )

    await applyPromotions(
      validPromotions.filter((p) => p.code === undefined).map((p) => p.code!)
    )
  }

  const addPromotionCode = async (formData: FormData) => {
    const code = formData.get("code")
    if (!code) {
      return
    }
    const input = document.getElementById("promotion-input") as HTMLInputElement
    const codes = promotions
      .filter((p) => p.code === undefined)
      .map((p) => p.code!)
    codes.push(code.toString())

    await applyPromotions(codes)

    if (input) {
      input.value = ""
    }
  }

  const [message, formAction] = useActionState(submitPromotionForm, null)

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <form action={formAction} className={styles.form}>
          <Label className={styles.label}>
            <PremiumActionButton
              compact
              text="Zadat slevový kód(y)"
              onClickAction={() => setIsOpen((current) => !current)}
              active={isOpen}
              type="button"
              className={styles.toggleBtn}
              data-testid="add-discount-button"
            />

            {/* <Tooltip content="You can add multiple promotion codes">
              <InformationCircleSolid color="var(--fg-muted)" />
            </Tooltip> */}
          </Label>

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                className={styles.promoReveal}
                initial={initial}
                animate={animate}
                exit={exit}
                transition={transition}
              >
                <div className={styles.row}>
                  <Input
                    className={styles.input}
                    id="promotion-input"
                    name="code"
                    type="text"
                    autoFocus
                    data-testid="discount-input"
                  />
                  <PremiumActionButton
                    compact
                    text="Použít"
                    type="submit"
                    data-testid="discount-apply-button"
                    className={styles.applyBtn}
                  />
                </div>

                <ErrorMessage
                  error={message}
                  data-testid="discount-error-message"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {promotions.length > 0 && (
          <div className={styles.promotionsWrap}>
            <div className={styles.promotionsCol}>
              <Heading className={styles.heading}>
                Použitý(é) slevový kód(y) použitý(é):
              </Heading>

              {promotions.map((promotion) => {
                return (
                  <div
                    key={promotion.id}
                    className={styles.promoRow}
                    data-testid="discount-row"
                  >
                    <Text className={styles.promoText}>
                      <span className="truncate" data-testid="discount-code">
                        <Badge
                          color={promotion.is_automatic ? "green" : "grey"}
                          size="small"
                        >
                          {promotion.code}
                        </Badge>{" "}
                        (
                        {promotion.application_method?.value !== undefined &&
                          promotion.application_method.currency_code !==
                            undefined && (
                            <>
                              {promotion.application_method.type ===
                              "percentage"
                                ? `${promotion.application_method.value}%`
                                : convertToLocale({
                                    amount: Number(
                                      promotion.application_method.value as any
                                    ),
                                    currency_code:
                                      promotion.application_method
                                        .currency_code,
                                  })}
                            </>
                          )}
                        )
                        {/* {promotion.is_automatic && (
                          <Tooltip content="This promotion is automatically applied">
                            <InformationCircleSolid className="inline text-zinc-400" />
                          </Tooltip>
                        )} */}
                      </span>
                    </Text>
                    {!promotion.is_automatic && (
                      <button
                        className={styles.removeBtn}
                        onClick={() => {
                          if (!promotion.code) {
                            return
                          }

                          removePromotionCode(promotion.code)
                        }}
                        data-testid="remove-discount-button"
                      >
                        <Trash size={14} />
                        <span className="sr-only">
                          Odebrat slevový kód z objednávky
                        </span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DiscountCode


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { height: 0, opacity: 0, y: -8 }
const animate = { height: "auto" as const, opacity: 1, y: 0 }
const exit = { height: 0, opacity: 0, y: -6 }
const transition = {
                  height: { duration: 0.48, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] },
                  opacity: { duration: 0.24, delay: 0.08 },
                  y: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
                }
