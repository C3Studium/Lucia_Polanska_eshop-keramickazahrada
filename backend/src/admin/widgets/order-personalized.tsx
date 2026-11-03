import { Container, Heading, Text } from "@medusajs/ui"
import { AdminOrder } from "@medusajs/framework/types"

/**
 * Rozměry u personalizovaných výrobků (cena podle rozměrů od zákazníka).
 * Personalizace je v obchodě spící (0 produktů), takže se karta skoro nikdy
 * neukáže; vykresluje ji „Práce s objednávkou" (`order-workspace-main.tsx`).
 */
export const OrderPersonalizedPanel =({ order }: { order: AdminOrder }) => {
  const items = (order.items ?? []).filter((item) => {
    return item.variant?.product?.metadata?.is_personalized
  })

  if (!items.length) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Výrobky na rozměr</Heading>
      </div>
      <div className="divide-y">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 px-6 py-4">
            {item.variant?.product?.thumbnail && <img
              src={item.variant.product.thumbnail}
              alt=""
              className="h-8 w-6 object-cover rounded border border-ui-border"
            />}
            <div className="flex flex-col">
              <Text size="small" weight="plus">
                {item.variant?.product?.title}: {item.variant?.title}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Šířka (cm): {(item.metadata?.width as number) || "neuvedeno"}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Výška (cm): {(item.metadata?.height as number) || "neuvedeno"}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}