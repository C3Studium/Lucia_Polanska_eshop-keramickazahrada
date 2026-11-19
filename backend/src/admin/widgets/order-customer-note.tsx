import type { AdminOrder } from "@medusajs/framework/types"
import { Badge, Text } from "@medusajs/ui"
import { OrderSection } from "../components/order-section"

/**
 * Poznámka od zákazníka k běžné objednávce (19. 11. 2026, Matěj).
 *
 * Zákazník ji píše v pokladně v kroku „Poznámka" (místo „Zadání" zakázky,
 * bez fotek, nepovinná). Uloží se do `cart.metadata.customer_note`, Medusa
 * ji při dokončení přenese do `order.metadata` — odsud se čte, žádná routa.
 * Klíč je tentýž jako ve storefrontu (`lib/util/customer-note.ts`).
 *
 * Bez poznámky se karta nekreslí vůbec; s poznámkou je rovnou otevřená.
 */
export const customerNoteOf = (order: AdminOrder): string | null => {
  const value = ((order as any)?.metadata ?? {}).customer_note
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export const OrderCustomerNotePanel = ({ order }: { order: AdminOrder }) => {
  const note = customerNoteOf(order)
  if (!note) return null
  return (
    <OrderSection
      title="Poznámka od zákazníka"
      badge={<Badge color="orange">Přečíst</Badge>}
      attention
    >
      <div className="px-6 py-4" data-testid="order-customer-note">
        <Text size="base" className="whitespace-pre-wrap break-words">
          {note}
        </Text>
      </div>
    </OrderSection>
  )
}
