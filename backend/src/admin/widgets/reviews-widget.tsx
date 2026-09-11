import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery, QueryClientProvider } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { adminQueryClient } from "../lib/query-client"

type StoreProductReview = {
  rating: number
  product_id: string
  // ...other fields
}

const queryClientProvider = adminQueryClient

const ProductReviewsWidgetInner = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const { data: response, isLoading } = useQuery<{ reviews: StoreProductReview[] }>({
    queryFn: () =>
      sdk.client.fetch(`/admin/reviews`, {
        query: { limit: 1000 }, // get all reviews (or use a high enough limit)
      }),
    queryKey: [["admin", "reviews"]],
  })

  // Filter reviews for this product
  const productReviews = response?.reviews?.filter(r => r?.product_id === product.id) || []

  const count = productReviews.length
  const average_rating =
    count > 0
      ? productReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / count
      : null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Recenze</Heading>
      </div>
      <Text className="px-6 py-4">
        {isLoading
          ? "Načítání..."
          : count > 0
          ? `Celkový počet recenzí: ${count}\n\nPrůměrné hodnocení: ${average_rating?.toFixed(2) ?? "-"}`
          : "Žádná data o recenzích nenalezena."}
      </Text>
    </Container>
  )
}

const ProductReviewsWidget = (props: DetailWidgetProps<AdminProduct>) => (
  <QueryClientProvider client={queryClientProvider}>
    <ProductReviewsWidgetInner {...props} />
  </QueryClientProvider>
)

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductReviewsWidget