import { HttpTypes } from "@medusajs/types"
import CartButton from "./button/cart-button"
import BuyNowButton from "./buy-now"
import WishlistToggle from "@modules/products/components/wishlist-toggle"
import {
  availabilityLabel,
  isPurchasable,
  type Availability,
} from "@lib/util/availability"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"

/**
 * Texty nákupu z bloku `global.produkt` (položky `nakup.*`). V kódu zůstává:
 * slovník dostupnosti (Skladem / Poslední kus / Na objednávku — sdílený
 * s kartami), věta o dobírce (pravidlo platby), režim výběru do úpravy
 * objednávky a chybové hlášky.
 */
const BUY_DEFAULTS = {
  "nakup.vyber": "Vyberte provedení",
  "nakup.pridat": "Přidat do košíku",
  "nakup.pridavame": "Přidáváme…",
  "nakup.pridano": "Přidáno do košíku",
  "nakup.v-kosiku": "Máte to v košíku.",
  "nakup.balne": "Každý kus balíme zvlášť proti poškození.",
} as const

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
  /**
   * Režim výběru do úpravy objednávky: tlačítko nese `label` („Přidat
   * k objednávce #N") a volá `handleAddToCart` předaný volajícím (ten nesahá
   * na košík). Oblíbené, „Koupit ihned" a věta o dobírce se schovají — nic se
   * tu nekupuje, platba je daná objednávkou. `blocked` = provedení, které
   * server nedovolí (`blockedText` to řekne vlastními slovy), `note` = věta
   * pod tlačítkem (u výměny kolik kusů se vymění).
   */
  pick?: { label: string; blocked: boolean; blockedText?: string; note?: string }
  /** Blok `global.produkt` — texty nákupu (viz BUY_DEFAULTS). */
  texts?: CopyBlock
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
  pick,
  texts,
}: CTAProps) {
  const text = (label: keyof typeof BUY_DEFAULTS) => itemText(texts, label, BUY_DEFAULTS[label])
  // A stepper only makes sense where more than one can be bought.
  const showStepper =
    Boolean(onQuantityChange) &&
    isPurchasable(availability) &&
    maxQuantity > 1 &&
    !pick?.blocked
  /* Název tlačítka se mění se stavem, takže se v místě neupravuje (editor by
     uložil jen ten, který je zrovna vidět) — jen ve formuláři bloku. Režim
     výběru do úpravy objednávky a vyprodané provedení drží kód. */
  const label = !selectedVariant
    ? text("nakup.vyber")
    : pick?.blocked
      ? "Tohle provedení nejde"
      : !inStock || !isValidVariant
        ? availabilityLabel["sold-out"]
        : pick
          ? addState.kind === "added"
            ? "Hotovo — vracíme vás na úpravu…"
            : pick.label
          : addState.kind === "added"
            ? text("nakup.pridano")
            : addState.kind === "adding"
              ? text("nakup.pridavame")
              : text("nakup.pridat")

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
        {!pick && (
          <div className="product__details__cta__buy__button__add">
            <WishlistToggle
              variantId={selectedVariant?.id}
              wishlistItems={wishlistItems}
              isAuthenticated={isAuthenticated}
            />
          </div>
        )}
        <CartButton
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            isAdding ||
            !isValidVariant ||
            Boolean(pick?.blocked) ||
            Boolean(pick && addState.kind === "added")
          }
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {label}
        </CartButton>

        {/* One click from here to the express payment step — only for a
            logged-in customer whose account already knows where to deliver.

            Stojí v TÉŽE řadě jako „Přidat do košíku", ne pod ní: jsou to dvě
            varianty jednoho rozhodnutí („chci to"), a pod sebou vypadaly jako
            dva různé kroky. Řada se umí zalomit (`flex-wrap`), takže na úzkém
            sloupci spadne druhé tlačítko pod první samo. */}
        {!pick && showBuyNow && countryCode && inStock && isValidVariant && (
          <BuyNowButton
            variantId={selectedVariant?.id}
            quantity={quantity}
            countryCode={countryCode}
            handle={product.handle}
            initialEligible={buyNowEligible}
            disabled={!inStock || !selectedVariant || isAdding || !isValidVariant}
          />
        )}
      </div>

      {addState.kind === "error" && (
        <p className="product__details__cta__error" role="alert">
          {addState.message}
        </p>
      )}
      {addState.kind === "added" && (
        <p
          className="product__details__cta__confirm"
          role="status"
          {...(pick ? {} : editableItem(texts, "nakup.v-kosiku"))}
        >
          {pick ? "Je to v návrhu úpravy." : text("nakup.v-kosiku")}
        </p>
      )}
      {pick?.blocked && (
        <p className="product__details__cta__error">
          {pick.blockedText ??
            "Tohle provedení k objednávce přidat nejde — vyberte prosím jiné."}
        </p>
      )}
      {pick?.note && !pick.blocked && <p>{pick.note}</p>}

      {/* One vocabulary, shared with the cards and the badge: Skladem / Poslední kus /
          Prodáno / Na objednávku (spec §12). */}
      <p>{availabilityLabel[availability]}</p>

      {/* The wait, in the merchant's words — only when the piece really is
          being made for this order, i.e. the availability says so. */}
      {availability === "made-to-order" && backorderNote && (
        <p className="product__details__cta__backorderNote">{backorderNote}</p>
      )}

      {/* Dobírka, said before checkout — finding out at the payment step
          feels like a trap, so the product page says it here. Ve výběru do
          objednávky ne: platba je daná objednávkou a nedobírkové kusy server
          do nabídky dobírkové objednávky vůbec nepustí. */}
      {/* Jen výjimka (Matěj 12. 10.): dobírka je výchozí, takže se říká jen
          tam, kde NEJDE — zakázka, zahraničí, vypnutá u výrobku. */}
      {!pick && !codAllowed && (
        <p className="product__details__cta__codNote">Nelze objednat na dobírku.</p>
      )}

      {/* Balné (Matěj 12. 10.): bez částky, jen proč — každý kus má vlastní
          balení proti poškození, v košíku je pak jako položka pod výrobkem. */}
      {!pick && (
        <p
          className="product__details__cta__codNote"
          data-testid="product-packaging-note"
          {...editableItem(texts, "nakup.balne")}
        >
          {text("nakup.balne")}
        </p>
      )}
    </div>
  )
}
