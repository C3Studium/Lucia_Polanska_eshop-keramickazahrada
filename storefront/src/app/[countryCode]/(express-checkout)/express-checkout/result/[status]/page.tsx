import ExpressResult from "@modules/express-checkout/Result"
import { notFound } from "next/navigation"

type Params = {
  params: Promise<{ countryCode: string; status: string }>
  searchParams: Promise<{ product?: string }>
}

const allowed = ["pending", "canceled", "failed"] as const

export default async function ExpressCheckoutResult({
  params,
  searchParams,
}: Params) {
  const { countryCode, status } = await params
  const { product } = await searchParams

  if (!allowed.includes(status as (typeof allowed)[number])) notFound()

  return (
    <ExpressResult
      status={status as (typeof allowed)[number]}
      countryCode={countryCode}
      productHandle={product}
    />
  )
}
