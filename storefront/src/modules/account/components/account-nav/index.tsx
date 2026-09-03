"use client"

import { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
import { useMemo, useState } from "react"

import { signout } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import DeleteAccountModal from "../delete-account"
import { accountEase } from "../../motion"

import styles from "./style.module.scss"

const navigation = [
  {
    index: "01",
    href: "/account",
    title: "Přehled",
    caption: "Všechno na jednom místě",
    testId: "overview-link",
  },
  {
    index: "02",
    href: "/account/profile",
    title: "Nastavení",
    caption: "Osobní údaje",
    testId: "profile-link",
  },
  {
    index: "03",
    href: "/account/addresses",
    title: "Adresy",
    caption: "Místa doručení",
    testId: "addresses-link",
  },
  {
    index: "04",
    href: "/account/orders",
    title: "Objednávky",
    caption: "Co jste u nás koupili",
    testId: "orders-link",
  },
  {
    index: "05",
    href: "/account/reviews",
    title: "Recenze",
    caption: "Vaše zkušenost",
    testId: "reviews-link",
  },
  {
    index: "06",
    href: "/account/wishlist",
    title: "Seznam přání",
    caption: "Uložené kousky",
    testId: "wishlist-link",
  },
  {
    index: "07",
    href: "/account/kurzy",
    title: "Kurzy",
    caption: "Rezervovaná místa",
    testId: "kurzy-link",
  },
]

type NavigationItem = (typeof navigation)[number]

const AccountNavigationLink = ({
  item,
  active,
}: {
  item: NavigationItem
  active: boolean
}) => {
  const [hovered, setHovered] = useState(false)
  const visualState = active || hovered ? "active" : "rest"

  return (
    <LocalizedClientLink
      href={item.href}
      className={active ? styles.accountNavCurrent : undefined}
      aria-current={active ? "page" : undefined}
      data-testid={item.testId}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <span className={styles.linkIndex}>{item.index}</span>
      <span className={styles.linkTitle}>{item.title}</span>
      <motion.span
        className={styles.linkLine}
        initial="rest"
        animate={visualState}
        variants={variants}
        transition={transition}
      />
      <motion.span
        className={styles.linkArrow}
        initial="rest"
        animate={visualState}
        variants={variants2}
        transition={{ duration: 0.38, ease: accountEase }}
      >
        ↗
      </motion.span>
    </LocalizedClientLink>
  )
}

const AccountNav = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) => {
  const route = usePathname() || ""
  const { countryCode } = useParams() as { countryCode: string }
  const [openModal, setOpenModal] = useState(false)

  const localRoute = route.replace(`/${countryCode}`, "") || "/account"
  const activeItem = useMemo(
    () =>
      [...navigation]
        .reverse()
        .find(({ href }) =>
          href === "/account"
            ? localRoute === href
            : localRoute === href || localRoute.startsWith(`${href}/`)
        ) || navigation[0],
    [localRoute]
  )

  const handleLogout = async () => {
    await signout(countryCode)
  }

  return (
    <>
      <aside className={styles.root} data-testid="account-nav">
        <div className={styles.top}>
          <p className={styles.eyebrow}>Váš účet · {activeItem.index}</p>
          <h2>
            Váš
            <em>účet.</em>
          </h2>
        </div>

        <div className={styles.chapter} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeItem.href}
              initial={initial}
              animate={animate}
              exit={exit}
              transition={transition2}
            >
              <span>{activeItem.index}</span>
              <strong>{activeItem.title}</strong>
              <small>{activeItem.caption}</small>
            </motion.div>
          </AnimatePresence>
        </div>

        <nav
          className={styles.navigation}
          aria-label="Navigace zákaznického účtu"
        >
          <ol>
            {navigation.map((item) => {
              const active = item.href === activeItem.href
              return (
                <li key={item.href}>
                  <AccountNavigationLink item={item} active={active} />
                </li>
              )
            })}
          </ol>
        </nav>

        <div className={styles.accountMeta}>
          <span>Jste přihlášeni</span>
          <p>{customer?.email}</p>
        </div>

        <div className={styles.actions}>
          <PremiumActionButton
            text="Odhlásit se"
            onClickAction={handleLogout}
            compact
            className={styles.accountLogoutAction}
            data-testid="logout-button"
          />
          <PremiumActionButton
            text="Smazat účet"
            onClickAction={() => setOpenModal(true)}
            compact
            className={styles.accountDeleteAction}
            data-testid="delete-account-button"
          />
        </div>
      </aside>
      <DeleteAccountModal
        countryCode={countryCode}
        customerEmail={customer?.email}
        open={openModal}
        onClose={() => setOpenModal(false)}
      />
    </>
  )
}

export default AccountNav


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff.

   Travel is viewport-relative, never px. The arrow nudge is horizontal, so it
   rides vw; the chapter swap competes for screen height, so it rides vh and
   shrinks by itself on a 1366x768 laptop along with the row it moves in.
   One reference viewport, 1440x900, and the rest is derived:
     ARROW_VW = 6 / 1440  -> 0.42vw
     ENTER_VH = 18 / 900  -> 2vh
     EXIT_VH  = ENTER_VH / 1.5   (the original 18:12 enter/exit ratio)
   Both ends of every interpolation keep the same expression shape ("0vw", not
   0), or framer stops interpolating the pair and the value jumps. */
const ARROW_VW = "-0.42vw"
const ENTER_VH = "2vh"
const EXIT_VH = "-1.333vh"

const variants = {
          rest: { scaleX: 0.12, opacity: 0.35 },
          active: { scaleX: 1, opacity: 0.68 },
        }
const transition = { duration: 0.55, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const variants2 = {
          rest: { opacity: 0, x: ARROW_VW, rotate: 0 },
          active: { opacity: 1, x: "0vw", rotate: 8 },
        }
const initial = { opacity: 0, y: ENTER_VH }
const animate = { opacity: 1, y: "0vh" }
const exit = { opacity: 0, y: EXIT_VH }
const transition2 = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
