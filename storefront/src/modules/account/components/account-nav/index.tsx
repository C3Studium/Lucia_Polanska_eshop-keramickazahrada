"use client"

import {
  ArrowRightOnRectangle,
  BookOpen,
  CogSixTooth,
  Heart,
  House,
  MapPin,
  ShoppingBag,
  Star,
  Trash,
} from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
    icon: House,
    title: "Přehled",
    caption: "Všechno na jednom místě",
    testId: "overview-link",
  },
  {
    index: "02",
    href: "/account/profile",
    icon: CogSixTooth,
    title: "Nastavení",
    caption: "Osobní údaje",
    testId: "profile-link",
  },
  {
    index: "03",
    href: "/account/addresses",
    icon: MapPin,
    title: "Adresy",
    caption: "Místa doručení",
    testId: "addresses-link",
  },
  {
    index: "04",
    href: "/account/orders",
    icon: ShoppingBag,
    title: "Objednávky",
    caption: "Co jste u nás koupili",
    testId: "orders-link",
  },
  {
    index: "05",
    href: "/account/reviews",
    icon: Star,
    title: "Recenze",
    caption: "Vaše zkušenost",
    testId: "reviews-link",
  },
  {
    index: "06",
    href: "/account/wishlist",
    icon: Heart,
    title: "Seznam přání",
    caption: "Uložené kousky",
    testId: "wishlist-link",
  },
  {
    index: "07",
    href: "/account/kurzy",
    icon: BookOpen,
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
  const Ikona = item.icon

  return (
    <LocalizedClientLink
      href={item.href}
      className={active ? styles.accountNavCurrent : undefined}
      aria-current={active ? "page" : undefined}
      data-testid={item.testId}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      /* Na úzkých obrazovkách zbude z odkazu jen ikona. Název proto zůstává
         v DOM a schovává se opticky (viz .linkTitle v CSS), ne přes
         display: none — přístupné jméno odkazu je pořád ten text. `title`
         přidává bublinu pro myš; na dotyku žádná není, a proto je tenhle
         tvar vyhrazený sloupci, kde se ikony opakují na každé podstránce. */
      title={item.title}
    >
      <span className={styles.linkIcon} aria-hidden="true">
        <Ikona />
      </span>
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

  /*
   * Vodorovný ukazatel posunu v telefonní liště.
   *
   * Lišta má `scrollbar-width: none` a mobilní prohlížeče kreslí posuvník
   * jen během doteku, takže na stojící stránce nic nenapovídá, že ikony
   * pokračují za pravým okrajem. Tenhle proužek je proto vlastní, ne
   * odkrytý systémový: `::-webkit-scrollbar` iOS Safari ignoruje.
   *
   * `size` je podíl viditelné části, `offset` pozice v dráze — obojí ve
   * zlomcích, převod na procenta dělá až JSX.
   */
  const navRef = useRef<HTMLElement | null>(null)
  const [scrollHint, setScrollHint] = useState({
    visible: false,
    size: 1,
    offset: 0,
  })

  const measureScrollHint = useCallback(() => {
    const el = navRef.current
    if (!el) {
      return
    }

    const skryte = el.scrollWidth - el.clientWidth

    /* Vracíme PŘEDCHOZÍ objekt, ne nový se stejnými čísly. ResizeObserver
       si sahá i na změny, které z měření nic nemění, a nový objekt by z
       každé takové udělal další render. */
    if (skryte <= 1) {
      setScrollHint((predchozi) =>
        predchozi.visible ? { visible: false, size: 1, offset: 0 } : predchozi
      )
      return
    }

    const size = el.clientWidth / el.scrollWidth
    const offset = (el.scrollLeft / skryte) * (1 - size)

    setScrollHint((predchozi) =>
      predchozi.visible &&
      Math.abs(predchozi.size - size) < 0.001 &&
      Math.abs(predchozi.offset - offset) < 0.001
        ? predchozi
        : { visible: true, size, offset }
    )
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) {
      return
    }

    measureScrollHint()
    el.addEventListener("scroll", measureScrollHint, { passive: true })

    /* Šířka lišty se mění i bez změny okna — otočením telefonu, skrytím
       adresního řádku, doběhnutím písem. Sledujeme proto oba boxy. */
    const observer = new ResizeObserver(measureScrollHint)
    observer.observe(el)
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild)
    }

    return () => {
      el.removeEventListener("scroll", measureScrollHint)
      observer.disconnect()
    }
  }, [measureScrollHint])

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
          ref={navRef}
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

          {/* Sticky, ne absolutní: leží uvnitř posouvané lišty, ale drží se
              jejího viditelného levého okraje, takže s ikonami neujíždí. */}
          <div
            className={styles.navScroll}
            aria-hidden="true"
            data-visible={scrollHint.visible ? "true" : "false"}
          >
            <i
              style={{
                width: `${scrollHint.size * 100}%`,
                left: `${scrollHint.offset * 100}%`,
              }}
            />
          </div>
        </nav>

        <div className={styles.accountMeta}>
          <span>Jste přihlášeni</span>
          <p>{customer?.email}</p>
        </div>

        {/* Ikonová dvojčata obou tlačítek. Vykreslují se vždycky a přepíná
            mezi nimi CSS, protože která varianta platí, rozhoduje šířka
            obrazovky — a to je otázka pro media query, ne pro JavaScript:
            s hookem na velikost okna by se první vykreslení na serveru
            netrefilo a tlačítka by po hydrataci poskočila. */}
        <div className={styles.actionsIcons}>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.iconAction}
            aria-label="Odhlásit se"
            title="Odhlásit se"
            data-testid="logout-button-icon"
          >
            <ArrowRightOnRectangle />
          </button>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className={`${styles.iconAction} ${styles.iconActionDanger}`}
            aria-label="Smazat účet"
            title="Smazat účet"
            data-testid="delete-account-button-icon"
          >
            <Trash />
          </button>
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
