import type { AdminOrder } from "@medusajs/framework/types"
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
 *
 * Vykresluje ho „Práce s objednávkou" (`order-workspace-main.tsx`), 3. 11. 2026.
 */

export const OrderGiftVouchersPanel = ({ order }: { order: AdminOrder }) => {
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

  /*
   * Poukazy UPLATNĚNÉ v téhle objednávce. V souhrnu se ukazuje jen „Sleva
   * celkem" — podle ní se nepozná, že zákazník platil dárkovým poukazem, ani
   * kterým a kolik z něj ubylo (3. 11. 2026).
   */
  const { data: pouzito } = useQuery({
    queryKey: ["gift-vouchers", "used-in-order", orderId],
    enabled: Boolean(orderId),
    queryFn: () =>
      sdk.client.fetch<{ gift_vouchers: AdminGiftVoucher[] }>(
        `/admin/gift-vouchers?used_in_order_id=${encodeURIComponent(orderId)}`
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
  /*
   * Jen poukazy, které v TÉHLE objednávce opravdu něco odečetly. Backend bez
   * podpory `used_in_order_id` (starší běžící verze) parametr přeskočí a vrátí
   * všechny poukazy — v sandboxu se pak u každé objednávky ukázalo ~60
   * „uplatněných" poukazů (3. 11. 2026).
   */
  const uplatnene = (pouzito?.gift_vouchers ?? []).filter((voucher) =>
    (voucher.redemptions ?? []).some((redemption) => redemption.order_id === orderId)
  )
  if (isLoading || (!vouchers.length && !uplatnene.length)) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-3">
      {uplatnene.length > 0 && (
        <Container className="divide-y p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <Heading level="h2">Zaplaceno dárkovým poukazem</Heading>
            <Badge size="2xsmall">{uplatnene.length}</Badge>
          </div>
          <div className="divide-y">
            {uplatnene.map((voucher) => {
              const tady = (voucher.redemptions ?? []).filter(
                (redemption) => redemption.order_id === orderId
              )
              const odecteno = tady
                .filter((redemption) => !redemption.reversed_at)
                .reduce((soucet, redemption) => soucet + redemption.amount, 0)
              const vracene = tady
                .filter((redemption) => redemption.reversed_at)
                .reduce((soucet, redemption) => soucet + redemption.amount, 0)
              return (
                <div key={voucher.id} className="flex flex-col gap-y-2 px-6 py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Text size="small" weight="plus" className="font-mono">
                      {voucher.code}
                    </Text>
                    <StateBadge voucher={voucher} />
                    <Text size="small" className="text-ui-fg-subtle">
                      {KIND_LABEL[voucher.kind]} · hodnota{" "}
                      {formatCzk(voucher.initial_value)} · platí do{" "}
                      {formatValidUntil(voucher.valid_until)}
                    </Text>
                  </div>
                  <Text size="small">
                    Z této objednávky odečteno {formatCzk(odecteno)} · na poukazu
                    zbývá {formatCzk(voucher.balance)}
                  </Text>
                  {vracene > 0 && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Vráceno zpátky na poukaz: {formatCzk(vracene)}
                    </Text>
                  )}
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Koupil {voucher.buyer_name}
                    {voucher.recipient_name ? ` · pro ${voucher.recipient_name}` : ""}
                  </Text>
                </div>
              )
            })}
          </div>
        </Container>
      )}

      {vouchers.length > 0 && (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Dárkové poukazy koupené v objednávce</Heading>
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
      )}
    </div>
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
