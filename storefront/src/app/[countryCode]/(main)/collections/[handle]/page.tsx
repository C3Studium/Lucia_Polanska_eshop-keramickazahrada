import { permanentRedirect } from "next/navigation"

type CollectionPageProps = {
  params: Promise<{ handle: string; countryCode: string }>
}

/**
 * Compatibility route for existing collection bookmarks and indexed URLs.
 * Collection browsing now lives in the current store catalogue.
 */
export default async function CollectionPage({ params }: CollectionPageProps) {
  const { handle, countryCode } = await params

  permanentRedirect(
    `/${countryCode}/store?collection=${encodeURIComponent(handle)}`
  )
}
