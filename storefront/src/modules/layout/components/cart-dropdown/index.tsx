"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import styles from "./style.module.scss"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import WebButton from "@modules/common/components/Buttons/webButton"
import Magnetic from "@modules/common/components/Buttons/Magnetic"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Cart from "@modules/common/icons/cart"
import Thumbnail from "@modules/products/components/thumbnail"
import { usePathname } from "next/navigation"
import { useDismiss } from "@lib/hooks/use-dismiss"
import { Fragment, useCallback, useEffect, useRef, useState, type WheelEvent } from "react"
import { motion } from 'framer-motion';
import { useFormStatus } from 'react-dom';
import CartDropdownQuantity from "./quantity"

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  const [activeTimer, setActiveTimer] = useState<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false)

  const open = () => setCartDropdownOpen(true)
  /* Stable, so the dismiss listeners bind once per open rather than once per render. */
  const close = useCallback(() => setCartDropdownOpen(false), [])

  /*
   * The panel is rendered `static`, so Headless UI hands its open state to us and stops managing
   * dismissal with it — including its own outside-click handling. `onMouseLeave` below covered
   * that on a desktop and nowhere else: a finger sends no `mouseleave`, so on a phone the cart
   * stayed open over the page until something inside it was tapped.
   *
   * The ref goes on the wrapper, which holds the button as well as the panel, so pressing the
   * cart icon still toggles instead of counting as a press outside.
   */
  const dismissRef = useDismiss<HTMLDivElement>(cartDropdownOpen, close)

  const totalItems =
    cartState?.items?.reduce((acc, item) => {
      return acc + item.quantity
    }, 0) || 0

  const cartTotal = cartState?.total ?? 0
  const itemRef = useRef<number>(totalItems || 0)
  const itemsRef = useRef<HTMLDivElement | null>(null)

  const timedOpen = () => {
    open()

    const timer = setTimeout(close, 5000)

    setActiveTimer(timer)
  }

  const openAndCancel = () => {
    if (activeTimer) {
      clearTimeout(activeTimer)
    }

    open()
  }

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (activeTimer) {
        clearTimeout(activeTimer)
      }
    }
  }, [activeTimer])

  const pathname = usePathname()

  // open cart dropdown when modifying the cart items, but only if we're not on the cart page
  useEffect(() => {
    if (itemRef.current !== totalItems && !pathname.includes("/cart")) {
      timedOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemRef.current])

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = itemsRef.current
    if (!el) return

    const delta = e.deltaY
    const atTop = el.scrollTop === 0
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight

    const tryingToScrollUpPastTop = atTop && delta < 0
    const tryingToScrollDownPastBottom = atBottom && delta > 0

    // If the container can scroll in the wheel direction, keep the event inside.
    // If the user is trying to scroll past the top or bottom, prevent the event so the page doesn't scroll.
    const canScrollUp = el.scrollTop > 0
    const canScrollDown = Math.ceil(el.scrollTop + el.clientHeight) < el.scrollHeight

    if ((delta < 0 && canScrollUp) || (delta > 0 && canScrollDown)) {
      // inner scrolling — stop propagation so the page doesn't pick up the event
      e.stopPropagation()
      return
    }

    if (tryingToScrollUpPastTop || tryingToScrollDownPastBottom) {
      // prevent the page from scrolling when flinging past edges
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div
      ref={dismissRef}
      className={styles.root}
      onMouseEnter={openAndCancel}
      onMouseLeave={close}
    >
      <Popover className={styles.popover}>
        <PopoverButton
          className={styles.popoverButton}
          onClick={() => setCartDropdownOpen((current) => !current)}
          aria-label={`Košík, ${totalItems} položek`}
          aria-expanded={cartDropdownOpen}
        >
          <span className={styles.cartLink} data-testid="nav-cart-link">
            <Magnetic>
              <Cart  size={40}/>
              <p className={styles.cartCount}>
                {totalItems}
              </p>
            </Magnetic>
          </span>
        </PopoverButton>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel
            static
            className={styles.popoverPanel}
            data-testid="nav-cart-dropdown"
          >
            <div className={styles.panelHeader}>
              <h3>Košík</h3>
            </div>
            {cartState && cartState.items?.length ? (
              <>
                <div className={styles.items} ref={itemsRef} onWheel={handleWheel}>
                  {cartState.items
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "")
                        ? -1
                        : 1
                    })
                    .map((item) => (
                      <div
                        className={styles.cartItem}
                        key={item.id}
                        data-testid="cart-item"
                      >
                        <LocalizedClientLink
                          href={`/products/${item.product_handle}`}
                          className={styles.productLink}
                        >
                          <Thumbnail
                            thumbnail={item.thumbnail}
                            images={item.variant?.product?.images}
                            size="square"
                          />
                        </LocalizedClientLink>
                        <div className={styles.itemDetails}>
                          <div className={styles.itemInfo}>
                            <div className={styles.itemHeader}>
                              <div className={styles.itemTitle}>
                                <h3>
                                  <LocalizedClientLink
                                    href={`/products/${item.product_handle}`}
                                    data-testid="product-link"
                                  >
                                    {item.title}
                                  </LocalizedClientLink>
                                </h3>
                                <LineItemOptions
                                  variant={item.variant}
                                  data-testid="cart-item-variant"
                                  data-value={item.variant}
                                />

                              </div>
                              <div className={styles.itemPrice}>
                                <LineItemPrice
                                  item={item}
                                  style="tight"
                                  currencyCode={cartState.currency_code}
                                />
                              </div>
                            </div>
                          </div>
                          {/* Množství a odebrání patří k sobě — dokud stály
                              pod sebou, byl každý řádek panelu o ovladač vyšší
                              a do panelu se vešly sotva dvě položky. */}
                          <div className={styles.itemActions}>
                            <CartDropdownQuantity item={item} />
                            <DeleteButton
                              id={item.id}
                              bundle_id={item.metadata?.bundle_id as string | undefined}
                              className={styles.removeBtn}
                              data-testid="cart-item-remove-button"
                            >
                              Odebrat
                            </DeleteButton>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <div className={styles.subtotal}>
                  <div className={styles.subtotalRow}>
                    <span className={styles.subtotalLabel}>
                      Celkem{" "}
                      <span className={styles.normal}>včetně DPH</span>
                    </span>
                    <span
                      className={styles.subtotalValue}
                      data-testid="cart-subtotal"
                      data-value={cartTotal}
                    >
                      {convertToLocale({
                        amount: cartTotal,
                        currency_code: cartState.currency_code,
                      })}
                    </span>
                  </div>
                  <LocalizedClientLink href="/cart" passHref>
                    <ClickButton
                      text="Přejít do košíku"
                      className={styles.goToCartBtn}
                      type="button"
                      data-testid="go-to-cart-button"
                    />
                  </LocalizedClientLink>
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyContent}>
                  <div className={styles.emptyIconContainer}>
                    <div className={styles.emptyIcon}>
                      <span>0</span>
                    </div>
                    <span>položek</span>
                  </div>

                  <span className={styles.emptyText}>V košíku zatím nic není.</span>
                  <div className={styles.emptyAction} onClick={close}>
                    <WebButton
                      title="Do obchodu"
                      href="/store"
                      Kind="Link"
                      className={styles.emptyStoreButton}
                      alt="Keramická zahrada"
                    />
                  </div>
                </div>
              </div>
            )}
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}

export default CartDropdown


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
                    transition={transition}
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


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.5, type: "tween" as const, ease: [0.76, 0, 0.24, 1] as [number, number, number, number]}
