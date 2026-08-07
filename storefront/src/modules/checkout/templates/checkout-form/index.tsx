import { listCartShippingMethods } from "@lib/data/fulfillment"
import {
  listCartPaymentMethods,
  listComgatePaymentMethods,
} from "@lib/data/payment"
import { isComgate, isPickupFulfillment } from "@lib/constants"
import { deliveryRestrictionFor } from "@lib/util/fragile"
import {
  cartAllowsDobirka,
  countryAllowsDobirka,
  deliveryCollectsDobirka,
} from "@lib/util/dobirka"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import { getProductionPaymentMode } from "@lib/data/made-to-order"
import styles from "./style.module.scss"

export default async function CheckoutForm({
  cart,
  customer,
  countryCode,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  countryCode: string
}) {
  if (!cart) {
    return null
  }

  const regionID = cart.region?.id ?? ""

  const productionMode = await getProductionPaymentMode(cart.id)
  const shippingMethods = await listCartShippingMethods(cart.id)
  const paymentMethods = await listCartPaymentMethods(regionID)

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  const comgateMethods = paymentMethods.some((method) => isComgate(method.id))
    ? await listComgatePaymentMethods({
        currencyCode: cart.currency_code,
        countryCode: cart.shipping_address?.country_code || countryCode,
        total: cart.total,
      })
    : []

  /*
   * Whether the chosen delivery is Osobní odběr, decided here rather than in the payment
   * step. The cart's own shipping_methods carry no fulfilment provider — the store cart is
   * not fetched with that relation — so reading it there always said "no", and „Zaplatíte
   * při vyzvednutí" was filtered out of the payment list even when collection was the
   * chosen delivery. The full option list is already in hand on this side; match on it.
   */
  const chosenOptionIds = new Set(
    (cart.shipping_methods ?? [])
      .map((method) => method.shipping_option_id)
      .filter(Boolean)
  )
  /*
   * Zakázková výroba restricts delivery to fragile carriage or collection. Either signal
   * counts — the catalogue category, or an enabled production profile — because today only
   * the first is set on any product and only the second drives the deposit.
   */
  /*
   * Fragile and zakázková výroba restrict delivery the same way, so they are decided
   * together — what differs is only the sentence the customer reads. Fragile wins when both
   * apply: it is the physical fact about the parcel.
   */
  const deliveryRestriction = deliveryRestrictionFor(
    cart as any,
    Boolean(productionMode?.has_made_to_order)
  )

  /*
   * Dobírka needs all three to hold: every piece allows it, the chosen delivery is a Česká
   * pošta carriage, and the address is Czech. Decided here for the same reason pickup is —
   * only this side can see the shipping option behind the cart's chosen method.
   */
  const chosenOption = shippingMethods.find((option) =>
    chosenOptionIds.has(option.id)
  )
  const allowsDobirka =
    cartAllowsDobirka(cart as any) &&
    countryAllowsDobirka(cart as any, countryCode) &&
    deliveryCollectsDobirka(
      chosenOption,
      (chosenOption as any)?.service_zone?.fulfillment_set?.type === "pickup"
    )

  const hasPickupShipping = shippingMethods.some(
    (option) =>
      chosenOptionIds.has(option.id) &&
      (isPickupFulfillment((option as any).provider_id) ||
        (option as any).service_zone?.fulfillment_set?.type === "pickup")
  )

  return (
    <div className={styles.root}>
      <Addresses cart={cart} customer={customer} countryCode={countryCode} />
      <Shipping
        cart={cart}
        availableShippingMethods={shippingMethods}
        packetaApiKey={process.env.NEXT_PUBLIC_PACKETA_API_KEY}
        packetaShippingMethodId={
          process.env.NEXT_PUBLIC_PACKETA_SHIPPING_METHOD_ID
        }
        restriction={deliveryRestriction}
      />
      <Payment
        cart={cart}
        availablePaymentMethods={paymentMethods}
        comgateMethods={comgateMethods}
        hasPickupShipping={hasPickupShipping}
        allowsDobirka={allowsDobirka}
      />
      <Review
        cart={cart}
        countryCode={countryCode}
        productionMode={productionMode}
      />
    </div>
  )
}
