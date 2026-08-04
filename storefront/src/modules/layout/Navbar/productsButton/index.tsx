"use client"

import Arrow from "@modules/common/icons/arrow"
import ArrowRight from "@modules/common/icons/arrow-right"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import LinkCat from "./Link"
import CollectionCategoryLink from "./CategoryLink"
import { AnimatePresence, Easing, motion, useAnimate, type AnimationSequence } from "framer-motion"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import styles from "./styles.module.scss"

export type NavigationCategory = {
  id: string
  name: string
  /** Catalogue URL for this entry — built by the data layer, which knows what it is. */
  href: string
}

export type NavigationCollection = {
  id: string
  title: string
  href: string
  image: string
  categories: NavigationCategory[]
}

type ProductButtonProps = {
  onClickAction: (next: boolean) => void
  isActive: boolean
  /** False when the catalogue returned nothing to put in the menu. */
  hasMenu?: boolean
}

type CollectionListProps = {
  active: boolean
  setActive: (next: boolean) => void
  collections: NavigationCollection[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
}

const ease = [0.76, 0, 0.24, 1] as Easing

const footerLinks = [
  { label: "Smluvní podmínky", href: "/smluvni-podminky" },
  { label: "Cookies", href: "/cookies" },
  { label: "Ochrana osobních údajů", href: "/ochrana-osobnich-udaju" },
  { label: "Odstoupení od smlouvy", href: "/odstoupeni-od-smlouvy" },
  { label: "Doprava a platba", href: "/doprava-a-platba" },
]

export function ProductButton({
  onClickAction,
  isActive,
  hasMenu = true,
}: ProductButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const highlighted = isActive || isHovered

  // With nothing to put in the menu, the label still has to lead somewhere: the
  // catalogue itself. A control that opens an empty panel is worse than a link.
  if (!hasMenu) {
    return (
      <LocalizedClientLink
        href="/store"
        className={styles.button}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ProductButtonFace highlighted={isHovered} />
      </LocalizedClientLink>
    )
  }

  return (
    <button
      type="button"
      className={styles.button}
      aria-expanded={isActive}
      aria-controls="collection-navigation"
      onClick={() => onClickAction(!isActive)}
      onMouseEnter={() => {
        setIsHovered(true)
        onClickAction(true)
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ProductButtonFace highlighted={highlighted} />
    </button>
  )
}

function ProductButtonFace({ highlighted }: { highlighted: boolean }) {
  return (
    <>
      <motion.span
        className={styles.buttonBackdrop}
        initial={false}
        animate={{ y: highlighted ? "0%" : "105%" }}
        transition={{ duration: 0.35, ease }}
      >
        <Image src="/assets/links/home_img.png" alt="" fill sizes="110px" />
        <span />
      </motion.span>
      <span className={styles.buttonLabel}>
        Produkty
        <motion.span animate={{ rotate: highlighted ? -45 : 0 }} transition={{ duration: 0.35, ease }}>
          {highlighted ? <ArrowRight size={12} color="white" /> : <Arrow size={12} />}
        </motion.span>
      </span>
    </>
  )
}

export function CollectionList({
  active,
  setActive,
  collections,
  activeIndex,
  onActiveIndexChange,
}: CollectionListProps) {
  const items = collections
  const safeActiveIndex = Math.min(activeIndex, items.length - 1)
  const [cardsScope, animateCards] = useAnimate<HTMLDivElement>()
  const previousIndex = useRef(0)

  useEffect(() => {
    if (!active || previousIndex.current === safeActiveIndex) return

    const sequence: AnimationSequence = items.map((_, index) => [
      `[data-collection-index="${index}"]`,
      { flexGrow: index === safeActiveIndex ? 4 : 1 },
      { duration: 0.62, ease, at: 0 },
    ])
    const controls = animateCards(sequence)

    previousIndex.current = safeActiveIndex
    return () => controls.stop()
  }, [active, animateCards, items, safeActiveIndex])

  useEffect(() => {
    if (!active) previousIndex.current = 0
  }, [active])

  return (
    <AnimatePresence initial={false}>
      {active && items.length > 0 && (
        <motion.div
          id="collection-navigation"
          className={styles.collectionList}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease }}
          onMouseLeave={() => setActive(false)}
        >
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Zavřít nabídku produktů"
            onMouseEnter={() => setActive(false)}
            onClick={() => setActive(false)}
          />
          <motion.div
            className={styles.menuPanel}
            initial={{ opacity: 0, y: -10, clipPath: "inset(0 0 100% 0 round 18px)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0 round 18px)" }}
            exit={{ opacity: 0, y: -8, clipPath: "inset(0 0 100% 0 round 18px)" }}
            transition={{ duration: 0.65, ease }}
            role="dialog"
            aria-label="Výběr produktových kolekcí"
          >
            {/* <div className={styles.collectionTabs} aria-label="Typ kolekce">
              {["Kolekce", "Kolekce", "Kolekce"].map((label, index) => (
                <button
                  key={`${label}-${index}`}
                  type="button"
                  className={index === 1 ? styles.collectionTabActive : ""}
                >
                  {label}
                </button>
              ))}
            </div>
            {currentCollection && (
              <motion.div
                className={styles.contextBar}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.35, ease }}
              >
                <button type="button" onClick={() => router.back()}>
                  <Arrow size={14} />
                  Zpět
                </button>
                <p><span>Kolekce</span> {currentCollection.title}</p>
              </motion.div>
            )} */}

            <div ref={cardsScope} className={styles.collectionCards}>
              {items.map((collection, index) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  index={index}
                  isActive={safeActiveIndex === index}
                  onActivate={() => onActiveIndexChange(index)}
                  onNavigate={() => setActive(false)}
                />
              ))}
            </div>
            <nav className={styles.menuFooter} aria-label="Důležité odkazy">
              <div className={styles.footerLinks}>
                {footerLinks.map((link, index) => (
                  <LinkCat
                    key={link.href}
                    text={link.label}
                    href={link.href}
                    index={index}
                    className={styles.footerLink}
                    onClickAction={() => setActive(false)}
                  />
                ))}
              </div>
              <div className={styles.footerMeta}>
                <span>Lucie Polanská · © {new Date().getFullYear()} všechna práva vyhrazena</span>
                <span>{new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }).format(new Date())} CET</span>
              </div>
            </nav>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type CollectionCardProps = {
  collection: NavigationCollection
  index: number
  isActive: boolean
  onActivate: () => void
  onNavigate: () => void
}

function CollectionCard({
  collection,
  index,
  isActive,
  onActivate,
  onNavigate,
}: CollectionCardProps) {
  // Without sub-categories the card still needs one link, and it should keep the
  // customer's context rather than dropping them on the unfiltered catalogue.
  const links = collection.categories.length
    ? collection.categories.map((category) => ({
        id: category.id,
        label: category.name,
        href: category.href,
      }))
    : [
        {
          id: `${collection.id}-all`,
          label: "Zobrazit vše",
          href: collection.href,
        },
      ]

  return (
    <motion.article
      className={styles.collectionCard}
      data-collection-index={index}
      style={{ flexGrow: index === 0 ? 4 : 1 }}
      onMouseEnter={() => {
        if (!isActive) onActivate()
      }}
      onFocus={onActivate}
    >
      <div className={`${styles.cardImage} ${isActive ? styles.cardImageActive : ""}`}>
        <Image src={collection.image} alt="" fill sizes="44vw" priority={index === 0} />
        <div className={`${styles.imageShade} ${isActive ? styles.imageShadeActive : ""}`} />
      </div>

      <LocalizedClientLink
        href={collection.href}
        className={styles.cardHitArea}
        aria-label={`Otevřít kolekci ${collection.title}`}
        onClick={onNavigate}
      />

      <AnimatePresence mode="sync" initial={false}>
        {!isActive ? (
          <motion.h3
            key="vertical-title"
            className={styles.verticalTitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.12 }}
          >
            {collection.title}
          </motion.h3>
        ) : (
          <motion.div
            key="expanded-content"
            className={styles.expandedContent}
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { delay: 0.1, delayChildren: 0.18, staggerChildren: 0.055 } },
            }}
          >
            <motion.span className={styles.cardEyebrow} variants={contentItemVariants}>
              {String(index + 1).padStart(2, "0")}
            </motion.span>
            <motion.h3 variants={contentItemVariants}>{collection.title}</motion.h3>
            <motion.div className={styles.categoryLinks} variants={contentItemVariants}>
              {links.map((link) => (
                <motion.div key={link.id} variants={categoryVariants}>
                  <CollectionCategoryLink
                    href={link.href}
                    onClick={onNavigate}
                    label={link.label}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {isActive && <span className={styles.openLabel}>Otevřít <ArrowRight size={12} color="white" /></span>}
    </motion.article>
  )
}

const contentItemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease } },
}

const categoryVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.38, ease } },
}
