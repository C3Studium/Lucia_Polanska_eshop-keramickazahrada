"use client"

import Arrow from "@modules/common/icons/arrow"
import ArrowRight from "@modules/common/icons/arrow-right"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import LinkCat from "./Link"
import CollectionCategoryLink from "./CategoryLink"
import { AnimatePresence, Easing, motion, useAnimate, type AnimationSequence } from "framer-motion"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import styles from "./styles.module.scss"

export type NavigationCategory = {
  id: string
  name: string
  handle: string | null
}

export type NavigationCollection = {
  id: string
  title: string
  handle: string | null
  image: string
  categories: NavigationCategory[]
}

type ProductButtonProps = {
  onClickAction: (next: boolean) => void
  isActive: boolean
}

type CollectionListProps = {
  active: boolean
  setActive: (next: boolean) => void
  collections: NavigationCollection[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
}

const ease = [0.76, 0, 0.24, 1] as Easing

const hardcodedCollections: NavigationCollection[] = Array.from({ length: 6 }, (_, collectionIndex) => ({
  id: `collection-${collectionIndex + 1}`,
  title: `Kolekce ${collectionIndex + 1}`,
  handle: null,
  image: "/assets/img/img/home_image.png",
  categories: Array.from({ length: 6 }, (_, categoryIndex) => ({
    id: `collection-${collectionIndex + 1}-category-${categoryIndex + 1}`,
    name: "kategorie",
    handle: null,
  })),
}))

const footerLinks = [
  { label: "Smluvní podmínky", href: "/smluvni-podminky" },
  { label: "Cookies", href: "/cookies" },
  { label: "Ochrana osobních údajů", href: "/ochrana-osobnich-udaju" },
  { label: "Odstoupení od smlouvy", href: "/odstoupeni-od-smlouvy" },
  { label: "Doprava a platba", href: "/doprava-a-platba" },
]

const getCollectionHref = (collection: NavigationCollection) =>
  collection.handle
    ? `/store?collection=${encodeURIComponent(collection.handle)}`
    : "/store"

const getCategoryHref = (category: NavigationCategory) =>
  category.handle
    ? `/store?category=${encodeURIComponent(category.handle)}`
    : "/store"

export function ProductButton({ onClickAction, isActive }: ProductButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const highlighted = isActive || isHovered

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
    </button>
  )
}

export function CollectionList({
  active,
  setActive,
  collections,
  activeIndex,
  onActiveIndexChange,
}: CollectionListProps) {
  const pathname = usePathname()
  const router = useRouter()
  const items = collections.length ? collections : hardcodedCollections
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

  const collectionMatch = pathname.match(/\/collections\/([^/?#]+)/)
  const currentCollection = collectionMatch
    ? items.find((collection) => collection.handle === decodeURIComponent(collectionMatch[1])) ?? null
    : null

  return (
    <AnimatePresence initial={false}>
      {active && (
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
  const categories = collection.categories.length
    ? collection.categories.slice(0, 6)
    : [{ id: `${collection.id}-fallback`, name: "Všechny produkty", handle: null }]

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
        href={getCollectionHref(collection)}
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
              Kolekce {String(index + 1).padStart(2, "0")}
            </motion.span>
            <motion.h3 variants={contentItemVariants}>{collection.title}</motion.h3>
            <motion.div className={styles.categoryLinks} variants={contentItemVariants}>
              {categories.map((category) => (
                <motion.div key={category.id} variants={categoryVariants}>
                  <CollectionCategoryLink
                    href={getCategoryHref(category)}
                    onClick={onNavigate}
                    label={category.name}
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
