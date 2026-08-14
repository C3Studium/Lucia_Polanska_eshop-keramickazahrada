import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";

const queryClient = new QueryClient();

type InvoiceState = {
  invoice_id: number | null;
  invoice_number: string | null;
  pdf_url: string | null;
  issued_at: string | null;
  paid_at: string | null;
  error: string | null;
};

type InvoiceResponse = {
  configured: boolean;
  test_mode: boolean;
  invoice: InvoiceState;
  dobirka: boolean;
  fully_captured: boolean;
};

/**
 * Faktura z iDokladu na detailu objednávky (FINISHINGTODOLIST §1): číslo,
 * stažení PDF, ruční vystavení/zopakování po chybě a zápis úhrady. Vystavování
 * jinak běží samo — po zaplacení, u dobírky při předání dopravci.
 */
const OrderInvoiceWidgetInner = ({ order }: { order: AdminOrder }) => {
  const cache = useQueryClient();
  const invoiceQuery = useQuery<InvoiceResponse>({
    queryKey: ["idoklad-invoice", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/idoklad/orders/${order.id}`, { method: "GET" }),
    retry: false,
  });

  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["idoklad-invoice", order.id] });
  };

  const issue = useMutation<{ invoice: InvoiceState }, Error>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/idoklad/orders/${order.id}/issue`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      toast.success(
        `Faktura ${result.invoice?.invoice_number ?? ""} byla vystavena`.trim()
      );
      await refresh();
    },
    onError: async (error) => {
      toast.error(error.message || "Fakturu se nepodařilo vystavit");
      await refresh();
    },
  });

  const markPaid = useMutation<{ invoice: InvoiceState }, Error>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/idoklad/orders/${order.id}/mark-paid`, {
        method: "POST",
      }),
    onSuccess: async () => {
      toast.success("Faktura je v iDokladu označená jako uhrazená");
      await refresh();
    },
    onError: async (error) => {
      toast.error(error.message || "Úhradu se nepodařilo zapsat");
      await refresh();
    },
  });

  if (invoiceQuery.isLoading) {
    return (
      <Container>
        <Skeleton className="h-24 rounded-lg" />
      </Container>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return null;
  }

  const { configured, test_mode: testMode, invoice, dobirka } = invoiceQuery.data;
  const hasInvoice = Boolean(invoice.invoice_id);

  const badge = hasInvoice ? (
    invoice.paid_at ? (
      <Badge color="green">Uhrazena</Badge>
    ) : (
      <Badge color="orange">Vystavena</Badge>
    )
  ) : invoice.error ? (
    <Badge color="red">Chyba</Badge>
  ) : (
    <Badge color="grey">Zatím žádná</Badge>
  );

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Faktura</Heading>
        <div className="flex items-center gap-x-2">
          {testMode && <Badge color="orange">Test</Badge>}
          {badge}
        </div>
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {testMode && (
          <Text size="small" className="text-ui-fg-subtle">
            Testovací režim — doklady se vystavují do zkušební agendy iDokladu,
            ne do ostrého účetnictví.
          </Text>
        )}
        {!configured && (
          <Text size="small" className="text-ui-fg-subtle">
            iDoklad není nakonfigurován (IDOKLAD_CLIENT_ID / SECRET). Faktury
            se nevystavují.
          </Text>
        )}

        {hasInvoice && (
          <>
            <div className="flex items-center justify-between gap-x-2">
              <Text size="small" className="text-ui-fg-subtle">
                Číslo faktury
              </Text>
              <Text size="small" weight="plus">
                {invoice.invoice_number ?? invoice.invoice_id}
              </Text>
            </div>
            {invoice.issued_at && (
              <div className="flex items-center justify-between gap-x-2">
                <Text size="small" className="text-ui-fg-subtle">
                  Vystaveno
                </Text>
                <Text size="small">{formatDateTime(invoice.issued_at)}</Text>
              </div>
            )}

            {invoice.pdf_url ? (
              <Button variant="secondary" size="small" asChild>
                <a href={invoice.pdf_url} target="_blank" rel="noreferrer">
                  Stáhnout PDF
                </a>
              </Button>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                PDF se nepodařilo uložit — najdete ho přímo v iDokladu.
              </Text>
            )}

            {!invoice.paid_at && (
              <Button
                variant="secondary"
                size="small"
                isLoading={markPaid.isPending}
                onClick={() => markPaid.mutate()}
              >
                Označit jako uhrazenou
              </Button>
            )}
          </>
        )}

        {!hasInvoice && invoice.error && (
          <Text size="small" className="text-ui-fg-error">
            {invoice.error}
          </Text>
        )}

        {!hasInvoice && configured && (
          <>
            {!invoice.error && (
              <Text size="small" className="text-ui-fg-subtle">
                {dobirka
                  ? "Vystaví se automaticky při předání dopravci."
                  : "Vystaví se automaticky po zaplacení objednávky."}
              </Text>
            )}
            <Button
              variant="secondary"
              size="small"
              isLoading={issue.isPending}
              onClick={() => issue.mutate()}
            >
              {invoice.error ? "Vystavit znovu" : "Vystavit fakturu"}
            </Button>
          </>
        )}
      </div>
    </Container>
  );
};

const OrderInvoiceWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <OrderInvoiceWidgetInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "keramicka-zahrada:order-invoice",
});

export default OrderInvoiceWidget;
