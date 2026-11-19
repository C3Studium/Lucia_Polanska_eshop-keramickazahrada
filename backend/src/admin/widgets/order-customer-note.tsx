import type { AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Text, Textarea, toast } from "@medusajs/ui"
import { useState } from "react"
import { OrderSection } from "../components/order-section"
import { sdk } from "../lib/sdk"
import { ceskaChyba } from "../lib/ceska-chyba"

/**
 * Poznámky k objednávce v pravém sloupci detailu (19. 11. 2026, Matěj).
 *
 * 1. „Poznámka od zákazníka" — z kroku „Poznámka" v pokladně
 *    (`cart.metadata.customer_note` → `order.metadata.customer_note`, klíč
 *    jako ve storefrontu `lib/util/customer-note.ts`). Karta je VŽDY, i
 *    u starší objednávky bez poznámky — pak „Žádná poznámka od zákazníka",
 *    ať je jasné, že se nic nepřehlédlo.
 * 2. „Poznámka pro dílnu" — interní, píše admin; uloží se do
 *    `order.metadata.admin_note` a vytiskne v listu pro dílnu (PDF) v rámečku
 *    „Poznámky dílny". Zákazník ji nikde nevidí.
 */
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

export const customerNoteOf = (order: AdminOrder): string | null =>
  text(((order as any)?.metadata ?? {}).customer_note)

export const adminNoteOf = (order: AdminOrder): string | null =>
  text(((order as any)?.metadata ?? {}).admin_note)

export const OrderCustomerNotePanel = ({ order }: { order: AdminOrder }) => {
  const note = customerNoteOf(order)
  return (
    <OrderSection
      title="Poznámka od zákazníka"
      badge={note ? <Badge color="orange">Přečíst</Badge> : <Badge color="grey">Žádná</Badge>}
      attention={Boolean(note)}
      defaultOpen
    >
      <div className="px-6 py-4" data-testid="order-customer-note">
        {note ? (
          <Text size="base" className="whitespace-pre-wrap break-words">
            {note}
          </Text>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Žádná poznámka od zákazníka.
          </Text>
        )}
      </div>
    </OrderSection>
  )
}

export const OrderAdminNotePanel = ({ order }: { order: AdminOrder }) => {
  const [ulozena, setUlozena] = useState(adminNoteOf(order) ?? "")
  const [navrh, setNavrh] = useState(ulozena)
  const [uklada, setUklada] = useState(false)
  const zmeneno = navrh.trim() !== ulozena.trim()

  const uloz = async () => {
    setUklada(true)
    try {
      /* Medusa metadata slučuje — klíč se píše vždy, i prázdný, jinak by
         vymazání poznámky nic nesmazalo. */
      await sdk.admin.order.update(order.id, {
        metadata: { admin_note: navrh.trim() },
      } as never)
      setUlozena(navrh.trim())
      toast.success("Poznámka pro dílnu uložena — vytiskne se v listu pro dílnu")
    } catch (error) {
      toast.error(ceskaChyba(error, "Poznámku se nepodařilo uložit"))
    } finally {
      setUklada(false)
    }
  }

  return (
    <OrderSection
      title="Poznámka pro dílnu"
      badge={ulozena ? <Badge color="blue">Uložena</Badge> : <Badge color="grey">Prázdná</Badge>}
      defaultOpen
    >
      <div className="flex flex-col gap-y-3 px-6 py-4" data-testid="order-admin-note">
        <Text size="small" className="text-ui-fg-subtle">
          Jen pro vás — zákazník ji neuvidí. Vytiskne se v listu pro dílnu (PDF)
          v rámečku „Poznámky dílny".
        </Text>
        <Textarea
          value={navrh}
          onChange={(event) => setNavrh(event.currentTarget.value)}
          placeholder="Např. glazura modrá, zabalit dvakrát, volat před předáním…"
          rows={4}
          maxLength={1000}
        />
        <div className="flex justify-end">
          <Button size="small" variant="secondary" onClick={uloz} isLoading={uklada} disabled={!zmeneno}>
            Uložit poznámku
          </Button>
        </div>
      </div>
    </OrderSection>
  )
}
