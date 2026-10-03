import {
  getExpressPrefillAddress,
  retrieveExpressCart,
} from "@lib/data/express-cart"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { getProductionPaymentMode } from "@lib/data/made-to-order"
import {
  listCartPaymentMethods,
  listComgatePaymentMethods,
} from "@lib/data/payment"
import { getBundleProduct, listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { Router } from "@modules/express-checkout/Router"
import { notFound } from "next/navigation"

type Params = {
  params: Promise<{ handle: string; countryCode: string }>
}

export default async function ExpressCheckoutPage({ params }: Params) {
  const { handle, countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) notFound()

  const product = await listProducts({
    countryCode,
    queryParams: {
      handle,
      fields:
        "*bundle,*images,*options,*variants,*variants.options,*variants.calculated_price,+variants.inventory_quantity,+metadata",
    },
  }).then(({ response }) => response.products[0])

  if (!product) notFound()

  const bundle = product.bundle
    ? await getBundleProduct(product.bundle.id, {
        currency_code: region.currency_code,
        region_id: region.id,
      }).then((response) => response.bundle_product)
    : undefined

  const cart = await retrieveExpressCart()
  const [
    shippingMethods,
    paymentMethods,
    comgateMethods,
    prefillAddress,
    productionMode,
  ] = await Promise.all([
    cart ? listCartShippingMethods(cart.id) : Promise.resolve([]),
    listCartPaymentMethods(region.id),
    cart
      ? listComgatePaymentMethods({
          currencyCode: cart.currency_code,
          countryCode: cart.shipping_address?.country_code || countryCode,
          total: cart.total,
        })
      : Promise.resolve([]),
    // Logged-in customers get the delivery form already filled in.
    getExpressPrefillAddress(countryCode),
    // Zakázka: kolik zaplatit hned (záloha) — potřebuje to krok platby.
    cart ? getProductionPaymentMode(cart.id) : Promise.resolve(null),
  ])

  return (
    <Router
      product={product}
      bundle={bundle}
      cart={cart}
      region={region}
      shippingMethods={shippingMethods || []}
      paymentMethods={paymentMethods || []}
      comgateMethods={comgateMethods}
      handle={handle}
      countryCode={countryCode}
      productionMode={productionMode}
      packetaApiKey={process.env.NEXT_PUBLIC_PACKETA_API_KEY}
      packetaShippingMethodId={
        process.env.NEXT_PUBLIC_PACKETA_SHIPPING_METHOD_ID
      }
      prefillAddress={prefillAddress}
    />
  )
}
