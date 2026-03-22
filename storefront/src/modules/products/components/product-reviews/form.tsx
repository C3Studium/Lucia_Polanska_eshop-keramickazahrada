"use client"

import { useState } from "react"

import { useEffect } from "react"
import { retrieveCustomer } from "../../../../lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import { Button, Divider, Input, Label, Textarea, toast, Toaster } from "@medusajs/ui"
import { Star, StarSolid } from "@medusajs/icons"
import { addProductReview } from "../../../../lib/client/reviews"
import styles from "./form.module.scss"
import { useFormStatus } from "react-dom"

import { motion } from 'framer-motion';

type ProductReviewsFormProps = {
  productId: string
}

export default function ProductReviewsForm({ productId }: ProductReviewsFormProps) {
  const [customer, setCustomer] = useState<HttpTypes.StoreCustomer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [rating, setRating] = useState(0)

  useEffect(() => {
    if (customer) {
      return
    }

    retrieveCustomer().then(setCustomer)
  }, [])

  if (!customer) {
    return (
      <div className={`product-page-constraint ${styles.container}`}>
        <div className={styles.center}>
          <span className="text-ui-fg-subtle">
            Pro přidání recenze se prosím <a href="/account" className="underline">přihlaste</a> nebo <a href="/account" className="underline">vytvořte účet</a>.
          </span>
        </div>
        <Toaster />
      </div>
    )
  }

  const submitReview = async () => {
    if (!content || !rating) {
      toast.error("Chyba", {
        description: "Prosím vyplňte povinná pole.",
      })
      return
    }

    setIsLoading(true)
    addProductReview({
      title,
      content,
      rating,
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      product_id: productId,
    }).then(() => {
      setShowForm(false)
      setTitle("")
      setContent("")
      setRating(0)
      toast.success("Úspěch", {
        description: "Vaše recenze byla odeslána",
      })
    }).catch(() => {
      toast.error("Chyba", {
        description: "Při odesílání vaší recenze došlo k chybě. Zkuste to prosím znovu později.",
      })
    }).finally(() => {
      setIsLoading(false)
    })
  }

  return (
    <div className={`product-page-constraint ${styles.container}`}>
        {!showForm && (
          <div className={styles.center}>
            <ClickButton
              text="Přidat recenzi"
              onClickAction={() => setShowForm(true)}
              type="button"
              className={styles.addReviewButton}
            />
          </div>
        )}
        {showForm && (
        <div className={styles.formSection}>
            <div className={styles.field}>
              <div className={styles.formTitleContainer}>
                <span className={styles.formTitle}>
                  Přidat recenzi
                </span>
                <Divider />
              </div>

            <form
              onSubmit={(e) => { e.preventDefault(); submitReview(); }}
              action="#"
              className={styles.form}
              noValidate
            >
              <div className={styles.field}>
                  <Label className={styles.label}>Název</Label>
                  <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Váš název" />
              </div>
              <div className={styles.field}>
                  <Label className={styles.label}>Obsah</Label>
                  <Textarea name="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Váš obsah" />
              </div>
              <div className={styles.starsRow}>
                  <Label className={styles.label}>Hodnocení</Label>
                  <div className={styles.stars}>
                  {Array.from({ length: 5 }).map((_, index) => (
                      <Button key={index} variant="transparent" onClick={(e) => {
                        e.preventDefault()
                        setRating(index + 1)
                        }} className={styles.starBtn}>
                        {rating >= index + 1 ? <StarSolid className="text-ui-tag-orange-icon" /> : <Star />}
                      </Button>
                  ))}
                  </div>
              </div>
              <ClickButton
                text="Odeslat"
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              />
              </form>
            </div>
        </div>
        )}
        <Toaster />
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