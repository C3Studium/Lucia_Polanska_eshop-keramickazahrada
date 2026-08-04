import { HttpTypes } from "@medusajs/types"
import CartButton from "./button/cart-button"
import WishlistToggle from "@modules/products/components/wishlist-toggle"

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
  handleAddToCart: () => void
  options?: Record<string, string | undefined>
  wishlistItems?: any[]
  isAuthenticated?: boolean
}

export default function CTA({
  inStock,
  selectedVariant,
  isAdding,
  addState = { kind: "idle" },
  isValidVariant,
  handleAddToCart,
  wishlistItems,
  isAuthenticated,
}: CTAProps) {
  const label = !selectedVariant
    ? "Vyberte variantu"
    : !inStock || !isValidVariant
      ? "Není skladem"
      : addState.kind === "added"
        ? "Přidáno ✓"
        : addState.kind === "adding"
          ? "Přidáváme…"
          : "Přidat do košíku"

  return (
    <div className="product__details__cta__buy">
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
          className="w-full h-10"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {label}
        </CartButton>
      </div>

      {addState.kind === "error" && (
        <p className="product__details__cta__error" role="alert">
          {addState.message}
        </p>
      )}
      {addState.kind === "added" && (
        <p className="product__details__cta__confirm" role="status">
          Objekt je v košíku.
        </p>
      )}

      {/* Availability note: previously said "Není skladem" for every variant without managed
          inventory, contradicting the button beside it. It follows the same `inStock` the
          button uses; the full vocabulary (Skladem / Poslední kus / Prodáno / Na objednávku)
          lands with Phase C. */}
      <p>
        {!inStock
          ? "Není skladem"
          : selectedVariant?.manage_inventory && selectedVariant?.inventory_quantity
            ? `${selectedVariant.inventory_quantity} skladem`
            : "Skladem"}
      </p>
    </div>
  )
}
