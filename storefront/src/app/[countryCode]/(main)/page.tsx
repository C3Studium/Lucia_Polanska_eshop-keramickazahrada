import { Metadata } from "next"

// import Hero from "@modules/home/components/original/hero"
// import FeaturedProducts from "@modules/home/components/original/featured-products"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import ScrollToTopOnReload from "@lib/helpers/scrollToTopOnReload"
import ECom from "@modules/home/E-com"
import Kurzy from "@modules/home/Kurzy"
import Info from "@modules/home/Info"
import HeroSection from "@modules/home/Hero"
import { client } from "../../../sanity/lib/client"

export const metadata: Metadata = {
  title: "Medusa Next.js Starter Template",
  description:
    "A performant frontend ecommerce starter template with Next.js 15 and Medusa.",
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

  const heroEnabled = settings?.heroSection?.enabled !== false
  const kurzyEnabled = settings?.kurzySection?.enabled !== false
  const ecomEnabled = settings?.ecomSection?.enabled !== false
  const infoEnabled = settings?.infoSection?.enabled !== false

  return (
    <>
      <ScrollToTopOnReload />
      {heroEnabled && <HeroSection />}
      {ecomEnabled && <ECom />}
      {/* {kurzyEnabled && <Kurzy />}
      {infoEnabled && <Info />} */}
      {/* <Hero />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div> */}
    </>
  )
}
