import type { AdminOrder } from "@medusajs/framework/types";
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useExpertMode } from "../lib/expert-mode";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { PanelError } from "../components/panel-error";

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
 *
 * Vykresluje ho „Práce s objednávkou" (`order-workspace.tsx`), 3. 11. 2026.
 */
export const OrderInvoicePanel = ({ order }: { order: AdminOrder }) => {
  const cache = useQueryClient();
  const expert = useExpertMode();
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
      toast.error(ceskaChyba(error, "Fakturu se nepodařilo vystavit"));
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
      toast.error(ceskaChyba(error, "Úhradu se nepodařilo zapsat"));
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

  // Nenačtená faktura se neschovává — jinak to vypadá, že u objednávky žádná
  // být nemá (viz components/panel-error).
  if (invoiceQuery.isError) {
    return <PanelError title="Faktura" onRetry={invoiceQuery.refetch} />;
  }
  if (!invoiceQuery.data) {
    return null;
  }

  const { configured, test_mode: testMode, invoice, dobirka } = invoiceQuery.data;
  /*
   * Objednávka, u které se nic nezachytí: celá uhrazená dárkovým poukazem,
   * nebo cena po domluvě objednaná za 0 Kč (platí se až přes zakázku).
   * Faktura visí na zachycení platby, takže u takové sama nevznikne — a věta
   * „vystaví se po zaplacení" by slibovala něco, co nepřijde (3. 11. 2026).
   */
  const bezPlatby = Number((order as any)?.total ?? 0) <= 0.005;
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
            Fakturace není napojená na iDoklad, faktury se nevystavují.
            {expert ? " (Chybí IDOKLAD_CLIENT_ID / IDOKLAD_CLIENT_SECRET.)" : ""}
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
                  : bezPlatby
                    ? "Objednávka je nulová — peníze přes bránu neprojdou, takže se faktura sama nevystaví. Jestli ji zákazník má dostat, vystavte ji tlačítkem."
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
