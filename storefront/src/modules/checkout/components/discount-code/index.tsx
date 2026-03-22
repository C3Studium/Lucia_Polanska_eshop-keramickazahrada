"use client"

import { Badge, Heading, Input, Label, Text } from "@medusajs/ui"
import React, { useActionState } from "react";

import { applyPromotions, submitPromotionForm } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import ErrorMessage from "../error-message"
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

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
            <ClickButton
              text="Zadat slevový kód(y)"
                onClickAction={() => setIsOpen(!isOpen)}
                active={isOpen}
              type="button"
              className={styles.toggleBtn}
              data-testid="add-discount-button"
            />

            {/* <Tooltip content="You can add multiple promotion codes">
              <InformationCircleSolid color="var(--fg-muted)" />
            </Tooltip> */}
          </Label>

          {isOpen && (
            <>
              <div className={styles.row}>
                <Input
                  className={styles.input}
                  id="promotion-input"
                  name="code"
                  type="text"
                  autoFocus={false}
                  data-testid="discount-input"
                />
                <ClickButton
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
            </>
          )}
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

type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
  active?: boolean; // external state to force animation (e.g. open)
    type?: "button" | "submit";
    className?: string;
    "data-testid"?: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
function ClickButton({ onClickAction, ClickAction, disabled = false, text, type = "button", className, active = false, "data-testid": dataTestId }: ClickButtonProps) {
  const [ isActive , setIsActive ] = useState<boolean>(false);
    const { pending } = useFormStatus();
    const isSubmitting = type === "submit" ? pending : false;
    const isDisabled = disabled || isSubmitting;
    const handleClick = onClickAction ?? ClickAction;
  const animateActive = isActive || active;

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
              animate={{top: animateActive ? "-100%" : "0%"}}
              transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
            >
              <div 
                  className={styles.el}
                  style={{ backgroundColor: "var(--darkOlive)" }}
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