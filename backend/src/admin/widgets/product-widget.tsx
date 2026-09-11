import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery, QueryClientProvider } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { 
  DetailWidgetProps, 
  AdminProduct,
} from "@medusajs/framework/types"
import { adminQueryClient } from "../lib/query-client"

type WishlistResponse = {
  count: number
}

const queryClient = adminQueryClient

const ProductWidgetInner = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  if (!product?.id) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Seznam Přání</Heading>
        </div>
        <Text className="px-6 py-4">
          Produkt nemá ID.
        </Text>
      </Container>
    )
  }

  const { data, isLoading } = useQuery<WishlistResponse>({
    queryFn: () => sdk.client.fetch(`/admin/products/${product.id}/wishlist`),
    queryKey: [["products", product.id, "wishlist"]],
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Seznam Přání</Heading>
      </div>
      <Text className="px-6 py-4">
        {isLoading ?
          "Načítání..." : `Tento produkt je v ${data?.count} seznamech přání.`
        }
      </Text>
    </Container>
  )
}

const ProductWidget = (props: DetailWidgetProps<AdminProduct>) => (
  <QueryClientProvider client={queryClient}>
    <ProductWidgetInner {...props} />
  </QueryClientProvider>
)


export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductWidget