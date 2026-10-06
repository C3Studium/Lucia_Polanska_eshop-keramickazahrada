import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Prompt,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client";

/**
 * Reklamace / vrácení na detailu objednávky — ať majitelka vidí stav i tady,
 * ne jen v „Vrácení". Stav, druh, lhůta, protokol a tlačítko „Vrátit peníze"
 * (celou částku); schválení/zamítnutí a částečné vrácení řeší stránka Vrácení.
 * Bez žádostí se widget nevykreslí.
 */

type ReturnRow = {
  id: string;
  order_display_id: string;
  kind: "reklamace" | "vraceni" | "odstoupeni" | null;
  reason: string;
  resolve_by: string | null;
  refunded_at: string | null;
  refund_amount: number | null;
  protocol_url: string | null;
  status: "pending" | "approved" | "rejected";
};

const KIND_LABEL: Record<string, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení",
  odstoupeni: "Odstoupení §1829",
};

const STATUS_META: Record<
  string,
  { label: string; color: "orange" | "green" | "red" }
> = {
  pending: { label: "Čeká na vyřízení", color: "orange" },
  approved: { label: "Schváleno", color: "green" },
  rejected: { label: "Zamítnuto", color: "red" },
};

const deadlineBadge = (resolveBy: string | null) => {
  if (!resolveBy) return null;
  const days = Math.ceil(
    (new Date(resolveBy).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  const overdue = days < 0;
  const label = overdue
    ? `Po lhůtě o ${Math.abs(days)} dní`
    : days === 0
      ? "Lhůta dnes"
      : `Zbývá ${days} dní`;
  const color: "red" | "orange" | "grey" =
    overdue || days <= 3 ? "red" : days <= 7 ? "orange" : "grey";
  return { label, color };
};

const RefundButton = ({ request }: { request: ReturnRow }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ message?: string }>(
        `/admin/return-requests/${request.id}/refund`,
        { method: "POST", body: {} }
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      await queryClient.invalidateQueries({ queryKey: ["return-requests"] });
      toast.success(result?.message ?? "Peníze byly vráceny.");
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Vrácení se nepodařilo"),
  });

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button size="small" variant="secondary">
          Vrátit peníze
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Vrátit celou zaplacenou částku?</Prompt.Title>
          <Prompt.Description>
            Placeno kartou → vrátí se přes ComGate, jinak se zaznamená k ručnímu
            vrácení. Zákazník dostane e-mail. Pro částečné vrácení použijte
            stránku Vrácení.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action onClick={() => mutation.mutate()}>
            Vrátit peníze
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

const Inner = ({ orderId }: { orderId: string }) => {
  const { data } = useQuery<{ return_requests: ReturnRow[] }>({
    queryKey: ["order-returns", orderId],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: { order_id: orderId, status: "all", limit: 20 },
      }),
  });

  const requests = data?.return_requests ?? [];
  if (!requests.length) {
    return null;
  }

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Reklamace a vrácení</Heading>
        <Button size="small" variant="transparent" asChild>
          <Link to="/prehled/vraceni">Otevřít Vrácení</Link>
        </Button>
      </div>

      {requests.map((request) => {
        const deadline = deadlineBadge(request.resolve_by);
        const statusMeta = STATUS_META[request.status];
        return (
          <div key={request.id} className="flex flex-col gap-y-2 px-6 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {request.kind && KIND_LABEL[request.kind] && (
                <Badge size="2xsmall" color="purple">
                  {KIND_LABEL[request.kind]}
                </Badge>
              )}
              {statusMeta && (
                <Badge size="2xsmall" color={statusMeta.color}>
                  {statusMeta.label}
                </Badge>
              )}
              {request.status === "pending" && deadline && (
                <Badge size="2xsmall" color={deadline.color}>
                  {deadline.label}
                </Badge>
              )}
              {request.refunded_at && (
                <Badge size="2xsmall" color="green">
                  Vráceno {request.refund_amount} Kč
                </Badge>
              )}
            </div>

            <Text size="small" className="text-ui-fg-subtle">
              {request.reason}
            </Text>

            <div className="flex flex-wrap items-center gap-3">
              {request.protocol_url && (
                <a
                  href={request.protocol_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-interactive txt-small hover:underline"
                >
                  Protokol (PDF)
                </a>
              )}
              {!request.refunded_at && <RefundButton request={request} />}
            </div>
          </div>
        );
      })}
    </Container>
  );
};

const queryClient = adminQueryClient;

const OrderReturnsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <Inner orderId={order.id} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
});

export default OrderReturnsWidget;
