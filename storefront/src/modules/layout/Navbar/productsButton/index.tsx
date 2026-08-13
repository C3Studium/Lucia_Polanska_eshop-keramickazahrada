"use client"

import Arrow from "@modules/common/icons/arrow"
import ArrowRight from "@modules/common/icons/arrow-right"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import LinkCat from "./Link"
import CollectionCategoryLink from "./CategoryLink"
import { AnimatePresence, Easing, motion, useAnimate, type AnimationSequence } from "framer-motion"
import Image from "next/image"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { withCount } from "@lib/util/plurals"
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
  /** Shown when the entry has no sub-categories to list. */
  productCount: number
}

type ProductButtonProps = {
  onClickAction: (next: boolean) => void
  isActive: boolean
  /** True anywhere in the catalogue, so the button stays lit like the other nav links do. */
  isRouteActive?: boolean
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

/**
 * Whether a pointer event is a real hover, and not a tap wearing a mouse costume.
 *
 * Chromium replays a touch tap as *compatibility* events about 150ms later, and those arrive
 * with `pointerType: "mouse"` — so reading the event's own type cannot tell them apart. Two
 * things can: a device that reports no hover at all never produces a genuine one, and a real
 * touch that happened moments ago explains any "mouse" event that follows it.
 *
 * Without this the menu shut 150ms after every tap: the backdrop appeared under the finger and
 * its hover-to-close fired on the tap's own echo.
 */
function useIsRealHover() {
  const lastTouchAt = useRef(-Infinity)
  const deviceHovers = useRef(true)

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => {
      deviceHovers.current = query.matches
    }
    sync()
    query.addEventListener("change", sync)

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        lastTouchAt.current = event.timeStamp
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true)

    return () => {
      query.removeEventListener("change", sync)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [])

  return useCallback((event: { pointerType?: string; timeStamp: number }) => {
    if (!deviceHovers.current) return false
    if (event.pointerType && event.pointerType !== "mouse") return false
    // The echo lands ~150ms after the tap; a second is comfortably clear of it.
    return event.timeStamp - lastTouchAt.current > 1000
  }, [])
}

/* Hoisted so the menu — which re-renders on every hover of a collection card — stops
   allocating a fresh object per motion prop, per card, per render. Values unchanged. */
const menuFadeFrom = { opacity: 0 }
const menuFadeTo = { opacity: 1 }
const menuFadeTransition = { duration: 0.35, ease }
const panelInitial = { opacity: 0, y: -10, clipPath: "inset(0 0 100% 0 round 18px)" }
const panelAnimate = { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0 round 18px)" }
const panelExit = { opacity: 0, y: -8, clipPath: "inset(0 0 100% 0 round 18px)" }
const panelTransition = { duration: 0.65, ease }
const crumbInitial = { opacity: 0, y: -8 }
const crumbAnimate = { opacity: 1, y: 0 }
const crumbTransition = { delay: 0.18, duration: 0.35, ease }
const titleTransition = { duration: 0.2, delay: 0.12 }
const cardContentVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { delay: 0.1, delayChildren: 0.18, staggerChildren: 0.055 },
  },
}
const flexGrowLead = { flexGrow: 4 }
const flexGrowRest = { flexGrow: 1 }
const thumbDown = { y: "105%" }
const thumbUp = { y: "0%" }
const arrowTilted = { rotate: -45 }
const arrowFlat = { rotate: 0 }


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
  isRouteActive = false,
  hasMenu = true,
}: ProductButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isRealHover = useIsRealHover()
  const highlighted = isActive || isHovered || isRouteActive
  /* Which input is driving decides what a press means. A mouse has hover, so the menu can
     preview itself on the way past and the click is free to do the obvious thing — go to the
     shop. A finger has no hover, so its first tap has to *be* the preview; a second tap, with
     the menu already open, goes through. Read from the event rather than sniffed from the
     user agent, so a touchscreen laptop behaves like whichever one is actually in your hand. */
  const pointerType = useRef("mouse")
  /* Whether the menu was already open when the press started. `isActive` cannot be trusted
     inside the click handler: the order is pointerdown → focus → click, and focus opens the
     menu, so by click time the state has already flipped and a toggle reads it backwards —
     which is exactly why the first tap opened and instantly re-closed. pointerdown lands
     before any of that. */
  const wasOpenAtPress = useRef(false)

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
        <ProductButtonFace highlighted={isHovered || isRouteActive} />
      </LocalizedClientLink>
    )
  }

  return (
    <LocalizedClientLink
      href="/store"
      className={styles.button}
      aria-expanded={isActive}
      aria-controls="collection-navigation"
      onPointerDown={(event: React.PointerEvent<HTMLAnchorElement>) => {
        pointerType.current = event.pointerType || "mouse"
        wasOpenAtPress.current = isActive
      }}
      onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
        // Keyboard Enter reports no pointer type, and a keyboard has no hover either — but it
        // has focus, which opens the menu below. So Enter is left to navigate.
        const isTouch = pointerType.current === "touch" || pointerType.current === "pen"

        /* A finger toggles, full stop. Making the second tap navigate instead read as a
           shortcut, but it took the toggle away: the obvious way to shut the menu — tap the
           thing you tapped to open it — walked you off the page instead, and nothing on
           screen said it would. The shop is reached from the „Zobrazit celý e-shop" link
           inside the menu, where it can be seen and read. */
        if (isTouch) {
          event.preventDefault()
          onClickAction(!wasOpenAtPress.current)
        }
      }}
      /* Deliberately pointer- rather than mouse-events: a tap emits a synthetic mouseenter
         *before* its click, which would open the menu and make the very first tap look like
         the second one — straight to /store, no menu, every time. */
      onPointerEnter={(event: React.PointerEvent<HTMLAnchorElement>) => {
        if (!isRealHover(event)) return
        setIsHovered(true)
        onClickAction(true)
      }}
      onPointerLeave={() => setIsHovered(false)}
      /* Without this the menu is unreachable by keyboard: Enter would only ever navigate.
         Gated on :focus-visible because a tap focuses too — and an unguarded open here beat
         the click handler to it, so a finger opened the menu on focus and then toggled it
         straight back shut on the very same tap. */
      onFocus={(event: React.FocusEvent<HTMLAnchorElement>) => {
        if (event.target.matches(":focus-visible")) onClickAction(true)
      }}
    >
      <ProductButtonFace highlighted={highlighted} />
    </LocalizedClientLink>
  )
}

function ProductButtonFace({ highlighted }: { highlighted: boolean }) {
  return (
    <>
      <motion.span
        className={styles.buttonBackdrop}
        initial={false}
        animate={highlighted ? thumbUp : thumbDown}
        transition={menuFadeTransition}
      >
        <Image src="/assets/links/home_img.png" alt="" fill sizes="110px" />
        <span />
      </motion.span>
      {/* Colour rides the same `highlighted` flag as the backdrop and arrow.
          The CSS :hover/[aria-expanded] rules alone missed the third case —
          being ON the catalogue route — leaving black text on the dark thumb. */}
      <span
        className={`${styles.buttonLabel} ${highlighted ? styles.buttonLabelOn : ""}`}
      >
        E-shop
        <motion.span animate={highlighted ? arrowTilted : arrowFlat} transition={menuFadeTransition}>
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
  const isRealHover = useIsRealHover()
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
          initial={menuFadeFrom}
          animate={menuFadeTo}
          exit={menuFadeFrom}
          transition={menuFadeTransition}
          /* Closing on leave is a mouse idea — a pointer that has moved away has said it is
             done. A finger emits the same events synthetically right after the tap. */
          onPointerLeave={(event) => {
            if (isRealHover(event)) setActive(false)
          }}
        >
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Zavřít nabídku produktů"
            // Same story: the tap's echo landed here the instant the backdrop appeared under
            // the finger. The click below is the touch way out, and stays unguarded.
            onPointerEnter={(event) => {
              if (isRealHover(event)) setActive(false)
            }}
            onClick={() => setActive(false)}
          />
          <motion.div
            className={styles.menuPanel}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={panelTransition}
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
                initial={crumbInitial}
                animate={crumbAnimate}
                transition={crumbTransition}
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
            {/* The one way into the shop as a whole. The cards each lead to a single
                collection and the footer below is legal text, so without this there was no
                „everything" — and on touch, where the button toggles rather than navigates,
                no route to /store at all. */}
            <LocalizedClientLink
              href="/store"
              className={styles.storeLink}
              onClick={() => setActive(false)}
              data-testid="menu-store-link"
            >
              <span>Zobrazit celý e-shop</span>
              <ArrowRight size={13} color="currentColor" />
            </LocalizedClientLink>

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
  // Sub-categories when the entry has them. When it does not — which is every card while the
  // catalogue has no collections — say how many objects are inside rather than offering a
  // "Zobrazit vše" link that just repeats the card itself.
  const links = collection.categories.map((category) => ({
    id: category.id,
    label: category.name,
    href: category.href,
  }))

  return (
    <motion.article
      className={styles.collectionCard}
      data-collection-index={index}
      style={index === 0 ? flexGrowLead : flexGrowRest}
      onMouseEnter={() => {
        if (!isActive) onActivate()
      }}
      onFocus={onActivate}
    >
      <div className={`${styles.cardImage} ${isActive ? styles.cardImageActive : ""}`}>
        <Image src={collection.image} alt="" fill sizes="44vw" priority={index === 0} />
        <div className={`${styles.imageShade} ${isActive ? styles.imageShadeActive : ""}`} />
      </div>

      {/* The whole card is the link, and the visible "Otevřít" pill lives inside it. It used
          to be a bare <span> stacked above this anchor, so clicking it did nothing. */}
      <LocalizedClientLink
        href={collection.href}
        className={styles.cardHitArea}
        aria-label={`Otevřít ${collection.title}`}
        onClick={onNavigate}
      >
        {isActive && (
          <span className={styles.openLabel}>
            Otevřít <ArrowRight size={12} color="white" />
          </span>
        )}
      </LocalizedClientLink>

      <AnimatePresence mode="sync" initial={false}>
        {!isActive ? (
          <motion.h3
            key="vertical-title"
            className={styles.verticalTitle}
            initial={menuFadeFrom}
            animate={menuFadeTo}
            exit={menuFadeFrom}
            transition={titleTransition}
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
            variants={cardContentVariants}
          >
            <motion.span className={styles.cardEyebrow} variants={contentItemVariants}>
              {String(index + 1).padStart(2, "0")}
            </motion.span>
            <motion.h3 variants={contentItemVariants}>{collection.title}</motion.h3>
            <motion.div className={styles.categoryLinks} variants={contentItemVariants}>
              {links.length > 0 ? (
                links.map((link) => (
                  <motion.div key={link.id} variants={categoryVariants}>
                    <CollectionCategoryLink
                      href={link.href}
                      onClick={onNavigate}
                      label={link.label}
                    />
                  </motion.div>
                ))
              ) : (
                <motion.span className={styles.cardCount} variants={categoryVariants}>
                  {withCount(collection.productCount, "výrobek", "výrobky", "výrobků")}
                </motion.span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
