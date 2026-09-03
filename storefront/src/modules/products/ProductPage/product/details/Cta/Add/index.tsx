import { HttpTypes } from "@medusajs/types"
import CartButton from "./button/cart-button"
import BuyNowButton from "./buy-now"
import WishlistToggle from "@modules/products/components/wishlist-toggle"
import {
  availabilityLabel,
  isPurchasable,
  type Availability,
} from "@lib/util/availability"

/** Add-to-cart is the moment the sale is made or lost; each state has to be visible. */
export type AddToCartState =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "added" }
  | { kind: "error"; message: string }

type CTAProps = {
  inStock: boolean
  selectedVariant: HttpTypes.StoreProductVariant | undefined
  variant?: HttpTypes.StoreProductVariant
  product: HttpTypes.StoreProduct
  disabled?: boolean
  isAdding: boolean
  addState?: AddToCartState
  isValidVariant: boolean
  availability?: Availability
  /** Merchant's own sentence about the wait when buying a sold-out piece. */
  backorderNote?: string | null
  /** Whether the carrier may collect cash for this piece — said up front. */
  codAllowed?: boolean
  quantity?: number
  maxQuantity?: number
  onQuantityChange?: (next: number) => void
  handleAddToCart: () => void
  options?: Record<string, string | undefined>
  wishlistItems?: any[]
  isAuthenticated?: boolean
  /** Route country — the express flow the buy-now button opens is per-country. */
  countryCode?: string
  /** Product-side gate: not made-to-order, not a commission piece. */
  showBuyNow?: boolean
  /** Build-time hint (logged-in + saved address); the button re-probes live. */
  buyNowEligible?: boolean
}

export default function CTA({
  inStock,
  selectedVariant,
  product,
  isAdding,
  addState = { kind: "idle" },
  isValidVariant,
  availability = "made-to-order",
  backorderNote = null,
  codAllowed = false,
  quantity = 1,
  maxQuantity = 0,
  onQuantityChange,
  handleAddToCart,
  wishlistItems,
  isAuthenticated,
  countryCode,
  showBuyNow = false,
  buyNowEligible = false,
}: CTAProps) {
  // A stepper only makes sense where more than one can be bought.
  const showStepper = Boolean(onQuantityChange) && isPurchasable(availability) && maxQuantity > 1
  const label = !selectedVariant
    ? "Vyberte provedení"
    : !inStock || !isValidVariant
      ? availabilityLabel["sold-out"]
      : addState.kind === "added"
        ? "Přidáno do košíku"
        : addState.kind === "adding"
          ? "Přidáváme…"
          : "Přidat do košíku"

  return (
    <div className="product__details__cta__buy">
      {showStepper && (
        <div className="product__details__cta__quantity">
          <span id="qty-label">Počet kusů</span>
          <div role="group" aria-labelledby="qty-label">
            <button
              type="button"
              onClick={() => onQuantityChange?.(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label="Snížit počet kusů"
            >
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              type="button"
              onClick={() => onQuantityChange?.(Math.min(maxQuantity, quantity + 1))}
              disabled={quantity >= maxQuantity}
              aria-label="Zvýšit počet kusů"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="product__details__cta__buy__buttons">
        <div className="product__details__cta__buy__button__add">
          <WishlistToggle
            variantId={selectedVariant?.id}
            wishlistItems={wishlistItems}
            isAuthenticated={isAuthenticated}
          />
        </div>
        <CartButton
          onClick={handleAddToCart}
          disabled={!inStock || !selectedVariant || isAdding || !isValidVariant}
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {label}
        </CartButton>
      </div>

      {/* One click from here to the express payment step — only for a
          logged-in customer whose account already knows where to deliver. */}
      {showBuyNow && countryCode && inStock && isValidVariant && (
        <BuyNowButton
          variantId={selectedVariant?.id}
          quantity={quantity}
          countryCode={countryCode}
          handle={product.handle}
          initialEligible={buyNowEligible}
          disabled={!inStock || !selectedVariant || isAdding || !isValidVariant}
        />
      )}

      {addState.kind === "error" && (
        <p className="product__details__cta__error" role="alert">
          {addState.message}
        </p>
      )}
      {addState.kind === "added" && (
        <p className="product__details__cta__confirm" role="status">
          Máte to v košíku.
        </p>
      )}

      {/* One vocabulary, shared with the cards and the badge: Skladem / Poslední kus /
          Prodáno / Na objednávku (spec §12). */}
      <p>{availabilityLabel[availability]}</p>

      {/* The wait, in the merchant's words — only when the piece really is
          being made for this order, i.e. the availability says so. */}
      {availability === "made-to-order" && backorderNote && (
        <p className="product__details__cta__backorderNote">{backorderNote}</p>
      )}

      {/* Dobírka, said before checkout — finding out at the payment step
          feels like a trap, so the product page says it here. */}
      <p className="product__details__cta__codNote">
        {codAllowed
          ? "Lze doručit na dobírku."
          : "Dobírka není možná, tento kus se platí předem."}
      </p>
    </div>
  )
}
