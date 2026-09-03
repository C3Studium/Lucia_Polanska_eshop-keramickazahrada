"use client"

import Image from "next/image"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Easing, motion } from "framer-motion"
import Magnetic from "@modules/common/components/Buttons/Magnetic"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "./cart"
import Cart from "@modules/common/icons/cart"
import { StoreCart, StoreRegion } from "@medusajs/types"
import RegionsSelect from "./regions"
import { useStateContext } from "@lib/context/StateContext"
import { useParams, usePathname } from "next/navigation"
import Button from "../../common/components/Buttons/button"
import SearchButton from "./searchButton"
import MobileNav from "./mobileNav"
import MobileBar from "./mobileBar"
import {
  CollectionList,
  NavigationCollection,
  ProductButton,
} from "./productsButton"
import ContactTrigger from "@modules/layout/ContactDialog/trigger"
import type { CopyButton } from "@lib/util/site-copy"
import NavbarSearch from "./navbarSearch"

type NavbarProps = {
  cart: StoreCart | null
  regions: StoreRegion[]
  isLoggedIn?: boolean
  wishlistItems?: any[]
  navigationCollections?: NavigationCollection[]
  /**
   * Tlačítka z CMS. Navbar sám je nepoužívá — předává je jen mobilní nabídce,
   * která je jediná z celého horního pruhu má editovatelné. Ta rozvaha je
   * v `mobileNav`.
   */
  buttons?: Record<string, CopyButton>
}

const navButtonHrefs = ["/", "/dotazy", "/vyroba", "/kurzy", "/o-mne"] as const

/*
 * The other nav buttons each own exactly one route, so an equality check settles them. E-shop
 * owns a whole branch of the site — the shop itself, a single object, and the collection and
 * category pages its own menu links to — so it matches on prefix instead. Without this it was
 * the one button in the bar that went dark the moment you used it.
 */
const catalogueRoots = [
  "/store",
  "/products",
  "/collections",
  "/categories",
] as const

export default function Navbar({
  cart,
  regions,
  isLoggedIn,
  wishlistItems = [],
  navigationCollections = [],
  buttons,
}: NavbarProps) {
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [isTablet, setIsTablet] = useState<boolean>(false)
  const dimension = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [isActive, setIsActive] = useState<boolean>(false)
  const [replayKey, setReplayKey] = useState<number>(0)

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeCollectionIndex, setActiveCollectionIndex] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isScrolled, setIsScrolled] = useState(false)

  const pathname = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()
  const pathActiveIdx = navButtonHrefs.findIndex((href) => {
    const localizedHref =
      href === "/" ? `/${countryCode}` : `/${countryCode}${href}`
    return pathname === localizedHref
  })

  const isCatalogueRoute = catalogueRoots.some((root) => {
    const base = `/${countryCode}${root}`
    return pathname === base || pathname.startsWith(`${base}/`)
  })

  const handleButtonActiveChange = (index: number | null) => {
    if (index !== null && pathActiveIdx === index) {
      setReplayKey((current) => current + 1)
    }

    setActiveIdx(index)
    setIsActive(index !== null)
  }

  const getButtonIsActive = (index: number) =>
    isActive ? activeIdx === index : pathActiveIdx === index

  useEffect(() => {
    setIsSearchOpen(false)
    setIsOpen(false)
    setIsMenuOpen(false)
  }, [pathname])

  /*
   * The bar's three overlays are mutually exclusive: search, the E-shop menu, and the links menu
   * each cover the page, so opening one has to put the others away. Routed through one place
   * rather than each opener remembering to close the other two — the E-shop button already
   * closed search and knew nothing about the hamburger, so the two could sit stacked.
   */
  const openExclusively = (panel: "search" | "products" | "menu" | null) => {
    setIsSearchOpen(panel === "search")
    setIsOpen(panel === "products")
    setIsMenuOpen(panel === "menu")

    if (panel === "products") {
      setActiveCollectionIndex(0)
    }
  }

  useEffect(() => {
    const updateNavbarSurface = () => setIsScrolled(window.scrollY > 28)

    updateNavbarSurface()
    window.addEventListener("scroll", updateNavbarSurface, { passive: true })
    return () => window.removeEventListener("scroll", updateNavbarSurface)
  }, [])

  const handleProductsOpenChange = (next: boolean) => {
    openExclusively(next ? "products" : null)
  }

  const handleMenuOpenChange = (next: boolean) => {
    openExclusively(next ? "menu" : null)
  }

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      // Update dimensions ref
      dimension.current = { width, height }

      // Check if mobile (width smaller than height = portrait)
      const isMobileDevice = width < height
      setIsMobile(isMobileDevice)

      // Check if tablet (mobile AND width > 550px)
      const isTabletDevice = isMobileDevice && width > 550
      setIsTablet(isTabletDevice)
    }

    // Run on mount
    updateDimensions()

    // Add resize listener
    window.addEventListener("resize", updateDimensions)

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("resize", updateDimensions)
    }
  }, [])

  return (
    <>
      <nav className={`navbar ${isScrolled ? "navbar--scrolled" : ""}`}>
        <CollectionList
          active={isOpen}
          setActive={setIsOpen}
          collections={navigationCollections}
          activeIndex={activeCollectionIndex}
          onActiveIndexChange={setActiveCollectionIndex}
        />
        <div
          className={`navbar__left ${
            isSearchOpen ? "navbar__left--search" : ""
          }`}
        >
          <Button
            className="navbar__brand"
            Kind="Link"
            img="/assets/links/home_img.png"
            alt=""
            title=""
            href="/"
            icon1="/assets/icons/logo.svg"
            icon2="/assets/icons/logowhite.svg"
            index={0}
            isActive={getButtonIsActive(0)}
            animationKey={pathActiveIdx === 0 ? replayKey : 0}
            onActiveChange={handleButtonActiveChange}
          />
          <Button
            className="navbar__nav-link"
            Kind="Link"
            img="/assets/links/home_img.png"
            alt=""
            title="Dotazy"
            href="/dotazy"
            index={1}
            isActive={getButtonIsActive(1)}
            animationKey={pathActiveIdx === 1 ? replayKey : 0}
            onActiveChange={handleButtonActiveChange}
          />
          <SearchButton
            isActive={isSearchOpen}
            value={searchQuery}
            onValueChange={setSearchQuery}
            onClick={() => openExclusively(isSearchOpen ? null : "search")}
          />
        </div>
        <div className="navbar__center">
          <div className="navbar__center-side navbar__center-side--left">
            <Button
              className="navbar__nav-link"
              Kind="Link"
              img="/assets/links/home_img.png"
              alt=""
              title="Výroba"
              href="/vyroba"
              index={2}
              isActive={getButtonIsActive(2)}
              animationKey={pathActiveIdx === 2 ? replayKey : 0}
              onActiveChange={handleButtonActiveChange}
            />
            <Button
              className="navbar__nav-link"
              Kind="Link"
              img="/assets/links/home_img.png"
              alt=""
              title="Kurzy"
              href="/kurzy"
              index={3}
              isActive={getButtonIsActive(3)}
              animationKey={pathActiveIdx === 3 ? replayKey : 0}
              onActiveChange={handleButtonActiveChange}
            />
          </div>
          <ProductButton
            onClickAction={handleProductsOpenChange}
            isActive={isOpen}
            isRouteActive={isCatalogueRoute}
            hasMenu={navigationCollections.length > 0}
          />
          <div className="navbar__center-side navbar__center-side--right">
            <ContactTrigger
              className="navbar__nav-link"
              text="Kontakt"
              img="/assets/links/home_img.png"
              alt=""
            />
            <Button
              className="navbar__nav-link"
              Kind="Link"
              img="/assets/links/home_img.png"
              alt=""
              title="O mně"
              href="/o-mne"
              index={4}
              isActive={getButtonIsActive(4)}
              animationKey={pathActiveIdx === 4 ? replayKey : 0}
              onActiveChange={handleButtonActiveChange}
            />
          </div>
        </div>
        {/*
          Its own pill, sitting where a phone's thumb expects a menu: top right, opposite the
          search. It used to ride inside the left pill next to the wordmark, which put both of
          the bar's two openers on the same side and left nothing on the right once the utility
          icons moved to the bottom bar. Above the compact stops the toggle is display:none, so
          this element collapses to nothing and the desktop bar is unchanged.
        */}
        <div className="navbar__menu">
          <MobileNav
            isOpen={isMenuOpen}
            onOpenChange={handleMenuOpenChange}
            buttons={buttons}
          />
        </div>

        {/* Phones get MobileBar below instead — this whole pill is display:none there. */}
        <div className="navbar__right">
          <RegionsSelect regions={regions} />
          <Suspense
            fallback={
              <LocalizedClientLink
                className="navbar__cartFallback"
                href="/cart"
                data-testid="nav-cart-link"
              >
                <Cart />
                <span className="cart__span">{0}</span>
              </LocalizedClientLink>
            }
          >
            <div className="navbar__cart">
              <CartButton cart={cart} />
            </div>
          </Suspense>
          <Magnetic>
            <LocalizedClientLink
              href="/account/wishlist"
              className="navbar__utility-link relative"
              aria-label="Oblíbené produkty"
            >
              <Image
                src="/assets/icons/bookmark.svg"
                alt="wishlist Icon button"
                width={35}
                height={35}
                className="Navbar__Icon"
              />
              {wishlistItems.length > 0 && (
                <span className="navbar__utility-count">
                  {wishlistItems.length}
                </span>
              )}
            </LocalizedClientLink>
          </Magnetic>
          <Magnetic>
            <LocalizedClientLink
              href="/account"
              className="Navbar__Icons__User navbar__utility-link"
              aria-label="Uživatelský účet"
            >
              <Image
                src="/assets/icons/user.svg"
                alt="user Icon button"
                width={35}
                height={35}
                className="Navbar__Icon"
              />
            </LocalizedClientLink>
          </Magnetic>
        </div>

        {/* Phones only, and hidden by its own stylesheet everywhere else. */}
        <MobileBar
          cart={cart}
          regions={regions}
          wishlistItems={wishlistItems}
        />
      </nav>
      <NavbarSearch
        countryCode={countryCode}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        query={searchQuery}
        onQueryChange={setSearchQuery}
      />
    </>
  )
}

type MobileIconsNavbarProps = {
  cart: StoreCart | null
  isLoggedIn?: boolean
  wishlistItems?: any[]
}

export const MobileIconsNavbar = ({
  cart,
  isLoggedIn,
  wishlistItems = [],
}: MobileIconsNavbarProps) => {
  const { firstLoad } = useStateContext()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const icons = useMemo(
    () => [
      {
        href: "/store",
        icon: (
          <Image
            src="/assets/icons/search.svg"
            alt="search Icon button"
            width={40}
            height={40}
            className="Navbar__Icon"
          />
        ),
      },
      ...(isLoggedIn
        ? [
            {
              href: "/account/wishlist",
              icon: (
                <Image
                  src="/assets/icons/bookmark.svg"
                  alt="bookmark Icon button"
                  width={40}
                  height={40}
                  className="Navbar__Icon"
                />
              ),
              hasCounter: true,
              counter: wishlistItems.length,
            },
          ]
        : []),
      { href: "/cart", icon: <Cart />, isCart: true },
      {
        href: "/account",
        icon: (
          <Image
            src="/assets/icons/user.svg"
            alt="user Icon button"
            width={40}
            height={40}
            className="Navbar__Icon"
          />
        ),
      },
    ],
    [isLoggedIn, wishlistItems.length]
  )
  const PreloaderAnim = {
    initial: {
      y: "100%",
    },
    start: {
      y: "100%",
      transition: {
        duration: 1.25,
        delay: !firstLoad ? 3 : 0,
        ease: [0.76, 0, 0.24, 1] as Easing,
      },
    },
    enter: {
      y: "0%",
      transition: {
        duration: 1.25,
        delay: !firstLoad ? 3 : 0,
        ease: [0.76, 0, 0.24, 1] as Easing,
      },
    },
  }

  const pathname = typeof window !== "undefined" ? window.location.pathname : ""
  useEffect(() => {
    const idx = icons.findIndex((icon) => pathname.startsWith(icon.href))
    setActiveIdx(idx !== -1 ? idx : null)
  }, [pathname, icons])

  return (
    <motion.div
      className="Navbar__subFooter"
      initial="initial"
      animate="enter"
      exit="exit"
      variants={PreloaderAnim}
    >
      <div className="Navbar__Icons">
        <ul>
          {icons.map((item, idx) => (
            <li key={idx} className={activeIdx === idx ? "active" : ""}>
              {item.isCart ? (
                <Suspense
                  fallback={
                    <LocalizedClientLink
                      className="hover:text-ui-fg-base flex gap-[2.5px] items-center justify-start flex-col"
                      href="/cart"
                      data-testid="nav-cart-link"
                    >
                      <Cart />
                      <span className="cart__span">{0}</span>
                    </LocalizedClientLink>
                  }
                >
                  <CartButton cart={cart} />
                </Suspense>
              ) : (
                <LocalizedClientLink
                  href={item.href}
                  className={`relative ${
                    item.href === "/store" ? "Navbar__Icons__Search" : ""
                  }`}
                >
                  <Magnetic>
                    {item.icon}
                    {item.hasCounter && item.counter > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {item.counter}
                      </span>
                    )}
                  </Magnetic>
                </LocalizedClientLink>
              )}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
