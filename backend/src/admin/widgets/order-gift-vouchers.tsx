import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { ceskaChyba } from "../lib/ceska-chyba"
import { formatCzk } from "../lib/workbench"
import {
  type AdminGiftVoucher,
  KIND_LABEL,
  StateBadge,
  formatValidUntil,
  stahnoutPoukazPdf,
} from "../components/gift-voucher-shared"

/**
 * Dárkové poukazy koupené v téhle objednávce — vystavit a poslat přímo
 * od objednávky, ať se kvůli jednomu poukazu nemusí hledat na stránce Poukazy.
 *
 * Elektronický poukaz odejde po zaplacení sám (`subscribers/gift-voucher-payment.ts`);
 * tady je vidět, že odešel a komu, a jde poslat znovu. Vytištěný se vystaví
 * jako PDF, vytiskne a přibalí nebo předá při osobním odběru.
 *
 * Poukazy vznikají až po `order.placed`, takže hned po dokončení objednávky
 * tu chvíli nemusí být — widget se pak prostě neukáže.
 */

const OrderGiftVouchersWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient()
  const orderId = String(order?.id ?? "")

  const { data, isLoading } = useQuery({
    queryKey: ["gift-vouchers", "order", orderId],
    enabled: Boolean(orderId),
    queryFn: () =>
      sdk.client.fetch<{ gift_vouchers: AdminGiftVoucher[] }>(
        `/admin/gift-vouchers?order_id=${encodeURIComponent(orderId)}`
      ),
  })

  const send = useMutation({
    mutationFn: (voucherId: string) =>
      sdk.client.fetch<{ email?: string }>(`/admin/gift-vouchers/${voucherId}/actions`, {
        method: "POST",
        body: { action: "send" },
      }),
    onSuccess: (outcome) => {
      toast.success(outcome?.email ?? "Poukaz odešel e-mailem.")
      queryClient.invalidateQueries({ queryKey: ["gift-vouchers"] })
    },
    onError: (error) => toast.error(ceskaChyba(error, "Poukaz se nepodařilo poslat.")),
  })

  const vouchers = data?.gift_vouchers ?? []
  if (isLoading || !vouchers.length) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Dárkové poukazy</Heading>
        <Badge size="2xsmall">{vouchers.length}</Badge>
      </div>
      <div className="divide-y">
        {vouchers.map((voucher) => (
          <div key={voucher.id} className="flex flex-col gap-y-3 px-6 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Text size="small" weight="plus" className="font-mono">
                {voucher.code}
              </Text>
              <StateBadge voucher={voucher} />
              <Text size="small" className="text-ui-fg-subtle">
                {formatCzk(voucher.initial_value)} · {KIND_LABEL[voucher.kind]} · platí do{" "}
                {formatValidUntil(voucher.valid_until)}
              </Text>
            </div>
            {voucher.recipient_name || voucher.recipient_email ? (
              <Text size="small" className="text-ui-fg-subtle">
                Pro {voucher.recipient_name || voucher.recipient_email}
                {voucher.sent_to ? ` · odesláno na ${voucher.sent_to}` : ""}
              </Text>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <PoukazPdf voucherId={voucher.id} />
              {voucher.payment_status === "paid" && voucher.status !== "cancelled" && (
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={send.isPending && send.variables === voucher.id}
                  onClick={() => send.mutate(voucher.id)}
                >
                  {voucher.sent_at ? "Poslat znovu" : "Poslat e-mailem"}
                </Button>
              )}
            </div>
            {voucher.payment_status !== "paid" && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Poukaz začne platit, až bude objednávka zaplacená.
              </Text>
            )}
          </div>
        ))}
      </div>
    </Container>
  )
}

const PoukazPdf = ({ voucherId }: { voucherId: string }) => {
  const vystavit = useMutation({
    mutationFn: (podoba: "summary" | "print") => stahnoutPoukazPdf(voucherId, podoba),
  })
  return (
    <>
      <Button
        size="small"
        variant="secondary"
        isLoading={vystavit.isPending && vystavit.variables === "summary"}
        onClick={() => vystavit.mutate("summary")}
      >
        Stáhnout poukaz (PDF)
      </Button>
      {/* Druhá podoba: dvě stránky A4 k oboustrannému tisku kartičky. */}
      <Button
        size="small"
        variant="secondary"
        isLoading={vystavit.isPending && vystavit.variables === "print"}
        onClick={() => vystavit.mutate("print")}
      >
        Kartička k tisku (PDF)
      </Button>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderGiftVouchersWidget
