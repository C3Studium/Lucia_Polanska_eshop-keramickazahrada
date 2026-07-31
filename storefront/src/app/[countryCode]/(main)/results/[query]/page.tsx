import { permanentRedirect } from "next/navigation"

type ResultsPageProps = {
  params: Promise<{ query: string; countryCode: string }>
}

/**
 * Compatibility route for shared legacy search URLs. Results now render in
 * the store catalogue rather than through the retired listing template.
 */
export default async function ResultsPage({ params }: ResultsPageProps) {
  const { query, countryCode } = await params

  permanentRedirect(
    `/${countryCode}/store?search=${encodeURIComponent(query)}`
  )
}
