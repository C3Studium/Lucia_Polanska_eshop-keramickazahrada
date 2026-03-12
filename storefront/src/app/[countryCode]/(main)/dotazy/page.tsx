import { Metadata } from "next"
import { client } from "../../../../sanity/lib/client"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"


import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import DotazyMain from "@modules/dotazy/main"
import FAQBody from "@modules/dotazy/FAQ"


export const metadata: Metadata = {
  title: "FAQ Page",
  description:
    "Frequently Asked Questions about our products, shipping, returns, and more.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  // this is the main page of the storefront
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  // Fetch main page settings from Sanity
  const settings = await client.fetch('*[_type == "mainPageSettings"][0]')

  if (!collections || !region) {
    return null
  }

  return (
    <>
        <ScrollToTopOnReload />
        <DotazyMain />
        <FAQBody />
    </>
  )
}
