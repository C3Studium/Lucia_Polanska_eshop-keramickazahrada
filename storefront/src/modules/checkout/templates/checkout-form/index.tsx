import { listCartShippingMethods } from "@lib/data/fulfillment"
import {
  listCartPaymentMethods,
  listComgatePaymentMethods,
} from "@lib/data/payment"
import { isComgate } from "@lib/constants"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
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
      />
      <Payment
        cart={cart}
        availablePaymentMethods={paymentMethods}
        comgateMethods={comgateMethods}
      />
      <Review cart={cart} countryCode={countryCode} />
    </div>
  )
}
