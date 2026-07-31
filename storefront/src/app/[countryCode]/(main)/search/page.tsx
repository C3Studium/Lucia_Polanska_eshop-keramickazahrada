import { permanentRedirect } from "next/navigation"

type SearchPageProps = {
  params: Promise<{ countryCode: string }>
}

/**
 * The standalone search page was retired. Search is available in the navbar
 * and the store catalogue; this redirect keeps old links functional.
 */
export default async function SearchPage({ params }: SearchPageProps) {
  const { countryCode } = await params

  permanentRedirect(`/${countryCode}/store`)
}
