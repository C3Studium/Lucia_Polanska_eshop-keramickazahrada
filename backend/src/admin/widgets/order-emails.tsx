import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";

/**
 * „Odeslané e-maily" on the order page (§16, P5-3).
 *
 * Twelve automatic e-mails now go out over an order's life, and until this
 * existed there was no way to answer „did the customer actually hear about
 * this?" without reading a database. That question comes up every time somebody
 * phones to say they were not told something — and the honest answer needs
 * evidence, not a guess about whether a subscriber fired.
 *
 * The rows are the native notification records, filtered to this order. Every
 * send is tagged with `resource_id`, which is what makes the list possible.
 */

type EmailRow = {
  id: string;
  to: string;
  template: string | null;
  status: "pending" | "success" | "failure";
  created_at: string;
  original_notification_id: string | null;
  subject: string | null;
};

/** Plain names — §17 keeps template identifiers off customer-facing pages. */
const templateLabels: Record<string, string> = {
  "order-placed": "Potvrzení objednávky",
  "payment-received": "Platba přijata",
  "payment-failed": "Platba se nezdařila",
  "payment-pending": "Odkaz k doplatku",
  "payment-refunded": "Vracíme peníze",
  "order-shipment": "Objednávka odeslána",
  "order-cancelled": "Objednávka zrušena",
  "order-processing": "Zadání potvrzeno",
  "order-refunded": "Objednávka vrácena",
  "order-review": "Prosba o recenzi",
  "order-ready-pickup": "Připraveno k vyzvednutí",
  "order-delivered": "Zásilka doručena",
  "order-delayed": "Výroba se protáhne",
};

const statusMeta: Record<
  EmailRow["status"],
  { label: string; color: "green" | "orange" | "red" }
> = {
  success: { label: "Odesláno", color: "green" },
  pending: { label: "Odesílá se", color: "orange" },
  failure: { label: "Nepodařilo se", color: "red" },
};

const OrderEmailsInner = ({ order }: { order: AdminOrder }) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ emails: EmailRow[] }>({
    queryKey: ["order-emails", order.id],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/emails", {
        query: { order_id: order.id, status: "all", limit: 50 },
      }),
  });

  const retry = useMutation<{ sent: boolean; message?: string }, Error, string>({
    mutationFn: (id) =>
      sdk.client.fetch(`/admin/notifications/${id}/retry`, { method: "POST" }),
    onSuccess: async (result) => {
      if (result.sent) {
        toast.success("E-mail byl odeslán znovu");
        await queryClient.invalidateQueries({ queryKey: ["order-emails"] });
      } else {
        // The provider's own reason — „nepodařilo se" alone helps nobody.
        toast.error(result.message ?? "Odeslat znovu se nepodařilo");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const emails = data?.emails ?? [];

  return (
    <Container className="divide-y p-0">
      <header className="px-6 py-4">
        <Heading level="h2">Odeslané e-maily</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Co zákazník o této objednávce dostal.
        </Text>
      </header>

      {isLoading && (
        <div className="px-6 py-4">
          <Skeleton className="h-10 rounded-lg" />
        </div>
      )}

      {!isLoading && emails.length === 0 && (
        <div className="px-6 py-5">
          <Text size="small" className="text-ui-fg-subtle">
            Zatím jsme k této objednávce nic neposlali.
          </Text>
        </div>
      )}

      {!isLoading && emails.length > 0 && (
        <div className="divide-y">
          {emails.map((email) => (
            <article
              key={email.id}
              className="flex flex-wrap items-center justify-between gap-2 px-6 py-3"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {email.subject ??
                    templateLabels[email.template ?? ""] ??
                    email.template ??
                    "E-mail"}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                  {formatDateTime(email.created_at)}
                  {email.original_notification_id ? " · opakované odeslání" : ""}
                </Text>
              </div>

              <div className="flex items-center gap-2">
                <Badge size="2xsmall" color={statusMeta[email.status].color}>
                  {statusMeta[email.status].label}
                </Badge>
                <Button
                  size="small"
                  variant="transparent"
                  isLoading={retry.isPending && retry.variables === email.id}
                  onClick={() => retry.mutate(email.id)}
                >
                  Poslat znovu
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const OrderEmailsWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <OrderEmailsInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.after",
  id: "keramicka-zahrada:order-emails",
});

export default OrderEmailsWidget;
