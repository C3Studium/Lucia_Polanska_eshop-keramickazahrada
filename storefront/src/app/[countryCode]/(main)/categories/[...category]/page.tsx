import { permanentRedirect } from "next/navigation"

type CategoryPageProps = {
  params: Promise<{ category: string[]; countryCode: string }>
}

/**
 * Compatibility route for existing category bookmarks and indexed URLs.
 * Category browsing now lives in the current store catalogue.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category, countryCode } = await params
  const handle = category.at(-1)
  const destination = handle
    ? `/${countryCode}/store?category=${encodeURIComponent(handle)}`
    : `/${countryCode}/store`

  permanentRedirect(destination)
}
