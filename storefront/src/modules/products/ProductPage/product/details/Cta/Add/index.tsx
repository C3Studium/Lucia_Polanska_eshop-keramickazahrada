import { HttpTypes } from "@medusajs/types";
import CartButton from "./button/cart-button";
import WishlistToggle from "@modules/products/components/wishlist-toggle";

type CTAProps = {
  inStock: boolean
  selectedVariant: HttpTypes.StoreProductVariant | undefined 
  variant?: HttpTypes.StoreProductVariant
  product: HttpTypes.StoreProduct
  disabled?: boolean
  isAdding: boolean
  isValidVariant: boolean
  handleAddToCart: () => void
  options?: Record<string, string | undefined>
  wishlistItems?: any[]
  isAuthenticated?: boolean
}

export default function CTA({
  inStock,
  selectedVariant,
  disabled,
  isAdding,
  isValidVariant,
  handleAddToCart,
  options,
  variant,
  product,
  wishlistItems,
  isAuthenticated
}: CTAProps) {
        // WIP: Create new button that will accept variants to change the text and might even the colors, plus can be disabled. like the button bellow from medusa ui

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
                    {!selectedVariant
                        ? "Vyberte variantu"
                        : !inStock || !isValidVariant
                        ? "Není skladem"
                        : "Přidat do košíku"}
                </CartButton>
            </div>
            <p>
                {selectedVariant?.inventory_quantity
                    ? `${selectedVariant.inventory_quantity} skladem`
                    : "Není skladem"
                    // WIP: add here variation inventory quantity for product made only on demand
                    // e.g. "pouze na objednávku"
                }
            </p>
        </div>
    )
}
