"use client"

import { Star, StarSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, Input, Label, Textarea, Toaster, toast } from "@medusajs/ui"
import { motion } from "framer-motion"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useFormStatus } from "react-dom"

import { retrieveCustomer } from "../../../../lib/data/customer"
import { addProductReview } from "../../../../lib/client/reviews"
import styles from "./form.module.scss"

type ProductReviewsFormProps = {
  productId: string
  previewMode?: boolean
}

export default function ProductReviewsForm({
  productId,
  previewMode = false,
}: ProductReviewsFormProps) {
  const [customer, setCustomer] = useState<HttpTypes.StoreCustomer | null>(null)
  const [hasResolvedCustomer, setHasResolvedCustomer] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(previewMode)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [rating, setRating] = useState(0)
  const previewCustomer = previewMode
    ? ({
        first_name: "Anna",
        last_name: "Nováková",
      } as HttpTypes.StoreCustomer)
    : null
  const activeCustomer = customer ?? previewCustomer
  const hasActiveCustomer = hasResolvedCustomer || previewMode

  useEffect(() => {
    let isActive = true

    retrieveCustomer()
      .then((resolvedCustomer) => {
        if (isActive) {
          setCustomer(resolvedCustomer)
        }
      })
      .catch(() => {
        if (isActive) {
          setCustomer(null)
        }
      })
      .finally(() => {
        if (isActive) {
          setHasResolvedCustomer(true)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const submitReview = async () => {
    if (!activeCustomer || !content || !rating) {
      toast.error("Chybí hodnocení", {
        description: "Prosím doplňte text recenze a počet hvězd.",
      })
      return
    }

    if (previewMode) {
      toast.success("Náhled formuláře", {
        description:
          "Toto je dočasný designový náhled. Recenze nebyla odeslána.",
      })
      return
    }

    setIsLoading(true)

    addProductReview({
      title,
      content,
      rating,
      first_name: activeCustomer.first_name || "",
      last_name: activeCustomer.last_name || "",
      product_id: productId,
    })
      .then(() => {
        setShowForm(false)
        setTitle("")
        setContent("")
        setRating(0)
        toast.success("Děkujeme", {
          description: "Vaše recenze byla odeslána ke schválení.",
        })
      })
      .catch((error) => {
        toast.error("Recenzi se nepodařilo odeslat", {
          description:
            error instanceof Error
              ? error.message
              : "Zkuste to prosím znovu za chvíli.",
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  return (
    <motion.aside
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.rail}>
        <span>Váš objekt · váš příběh</span>
        <i />
        <span>05</span>
      </div>

      <div className={styles.invitation}>
        <div className={styles.invitationCopy}>
          <span className={styles.eyebrow}>Zkušenost, která zůstává</span>
          <h2>
            Máte objekt doma?
            <em>Řekněte, jak s vámi žije.</em>
          </h2>
          <p>
            Vaše zkušenost pomůže dalším lidem vybrat si objekt, který jim bude
            dělat radost dlouho.
          </p>
        </div>

        <div className={styles.reviewSeal} aria-hidden="true">
          <i />
          <i />
          <span>5</span>
          <small>hvězd</small>
        </div>
      </div>

      {!hasActiveCustomer ? (
        <div className={styles.loadingState} aria-label="Načítání účtu">
          <i />
          <span>Ověřujeme váš účet</span>
        </div>
      ) : !activeCustomer ? (
        <div className={styles.authPrompt}>
          <p>
            Pro přidání recenze se přihlaste, nebo si během chvíle vytvořte
            účet.
          </p>
          <div className={styles.authActions}>
            <Link href="/account" className={styles.primaryAction}>
              Přihlásit se
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/account" className={styles.secondaryAction}>
              Vytvořit účet
            </Link>
          </div>
        </div>
      ) : !showForm ? (
        <div className={styles.memberPrompt}>
          <p>
            {activeCustomer.first_name
              ? `${activeCustomer.first_name}, jaký je váš objekt v každodenním životě?`
              : "Jaký je váš objekt v každodenním životě?"}
          </p>
          <ClickButton
            text="Napsat recenzi"
            onClickAction={() => setShowForm(true)}
            type="button"
            className={styles.addReviewButton}
          />
        </div>
      ) : (
        <motion.div
          className={styles.formSection}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.formHeader}>
            <span>Vaše recenze</span>
            <button type="button" onClick={() => setShowForm(false)}>
              Zavřít
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              submitReview()
            }}
            action="#"
            className={styles.form}
            noValidate
          >
            <div className={styles.field}>
              <Label className={styles.label}>Název recenze</Label>
              <Input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Například: Dělá mi radost každý den"
              />
            </div>

            <div className={styles.field}>
              <Label className={styles.label}>Vaše zkušenost</Label>
              <Textarea
                name="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Napište, kam jste objekt umístili a co na něm máte rádi…"
              />
            </div>

            <div className={styles.starsRow}>
              <Label className={styles.label}>Hodnocení</Label>
              <div className={styles.stars}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="transparent"
                    onClick={() => setRating(index + 1)}
                    className={styles.starBtn}
                    aria-label={`${index + 1} z 5 hvězd`}
                    aria-pressed={rating === index + 1}
                  >
                    {rating >= index + 1 ? <StarSolid /> : <Star />}
                  </Button>
                ))}
              </div>
            </div>

            <ClickButton
              text={isLoading ? "Odesíláme…" : "Odeslat recenzi"}
              type="submit"
              disabled={isLoading}
              className={styles.submitButton}
            />
          </form>
        </motion.div>
      )}

      <Toaster />
    </motion.aside>
  )
}

type ClickButtonProps = {
  text: string
  onClickAction?: () => void | Promise<void>
  disabled?: boolean
  type?: "button" | "submit"
  className?: string
}

function ClickButton({
  onClickAction,
  disabled = false,
  text,
  type = "button",
  className,
}: ClickButtonProps) {
  const [isActive, setIsActive] = useState(false)
  const { pending } = useFormStatus()
  const isSubmitting = type === "submit" ? pending : false
  const isDisabled = disabled || isSubmitting

  return (
    <div
      className={
        className ? `${styles.ClickButton} ${className}` : styles.ClickButton
      }
    >
      <button
        type={type}
        className={styles.button}
        onClick={onClickAction}
        disabled={isDisabled}
        aria-busy={isDisabled || undefined}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
      >
        <motion.span
          className={styles.slider}
          animate={{ y: isActive ? "-50%" : "0%" }}
          transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
        >
          <span className={styles.el}>
            <PerspectiveText label={text} />
          </span>
          <span className={styles.el}>
            <PerspectiveText label={text} />
          </span>
        </motion.span>
      </button>
    </div>
  )
}

function PerspectiveText({ label }: { label: string }) {
  return (
    <span className={styles.perspectiveText}>
      <span>{label}</span>
    </span>
  )
}
