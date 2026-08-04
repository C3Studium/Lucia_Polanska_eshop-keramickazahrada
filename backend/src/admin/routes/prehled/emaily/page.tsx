import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Tabs,
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
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

type EmailRow = {
  id: string;
  to: string;
  template: string | null;
  status: "pending" | "success" | "failure";
  created_at: string;
  resource_id: string | null;
  resource_type: string | null;
  original_notification_id: string | null;
  subject: string | null;
};

type EmailsResponse = {
  emails: EmailRow[];
  count: number;
  failure_count: number;
};

type RetryResponse = { sent: boolean; message?: string };

/**
 * Plain-language names for the templates. §17 forbids technical strings on
 * custom pages, and „order-shipment" is exactly that — but this page is also
 * where a delivery problem gets diagnosed, so an unknown template falls back to
 * its own name rather than being hidden.
 */
const templateLabels: Record<string, string> = {
  "order-placed": "Potvrzení objednávky",
  "payment-received": "Platba přijata",
  "payment-failed": "Platba se nezdařila",
  "payment-pending": "Odkaz k platbě",
  "order-shipment": "Objednávka odeslána",
  "order-cancelled": "Objednávka zrušena",
  "order-review": "Prosba o recenzi",
  "variant-restock": "Zboží je opět skladem",
  "abandoned-cart": "Nedokončený nákup",
  "email-verification": "Ověření e-mailu",
  "password-reset": "Obnovení hesla",
  "user-invited": "Pozvánka do administrace",
  "merchant-notification": "Upozornění pro vás",
};

const statusMeta: Record<
  EmailRow["status"],
  { label: string; color: "green" | "orange" | "red" }
> = {
  success: { label: "Odesláno", color: "green" },
  pending: { label: "Odesílá se", color: "orange" },
  failure: { label: "Nepodařilo se", color: "red" },
};

const tabs = [
  { key: "failure", label: "Nezdařené" },
  { key: "all", label: "Všechny" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const EmailRowItem = ({ email }: { email: EmailRow }) => {
  const queryClient = useQueryClient();

  const retry = useMutation<RetryResponse>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/notifications/${email.id}/retry`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      if (result.sent) {
        toast.success("E-mail byl odeslán znovu");
        await queryClient.invalidateQueries({ queryKey: ["operations-emails"] });
        await queryClient.invalidateQueries({
          queryKey: ["operations-summary"],
        });
      } else {
        // The provider's own words. „Nepodařilo se" alone would leave nobody
        // any wiser about whether it is a bad address or a bad API key.
        toast.error(result.message ?? "Odeslat znovu se nepodařilo");
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Odeslat znovu se nepodařilo"
      );
    },
  });

  return (
    <article className="grid gap-3 px-6 py-4 lg:grid-cols-[170px_minmax(0,1fr)_150px_auto] lg:items-center">
      <Text size="small" className="text-ui-fg-subtle">
        {formatDateTime(email.created_at)}
      </Text>

      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {email.subject ??
            templateLabels[email.template ?? ""] ??
            email.template ??
            "E-mail"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle truncate">
          {email.to}
        </Text>
        {email.original_notification_id && (
          <Text size="xsmall" className="text-ui-fg-muted mt-1">
            Opakované odeslání
          </Text>
        )}
      </div>

      <div className="flex items-center gap-x-2">
        <Badge size="2xsmall" color={statusMeta[email.status].color}>
          {statusMeta[email.status].label}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {email.resource_type === "order" && email.resource_id && (
          <Button size="small" variant="transparent" asChild>
            <Link to={`/orders/${email.resource_id}`}>Objednávka</Link>
          </Button>
        )}
        {email.status === "failure" && (
          <Button
            size="small"
            variant="secondary"
            isLoading={retry.isPending}
            onClick={() => retry.mutate()}
          >
            Poslat znovu
          </Button>
        )}
      </div>
    </article>
  );
};

const EmailyInner = () => {
  const [tab, setTab] = useState<TabKey>("failure");

  const { data, isLoading, isError, refetch } = useQuery<EmailsResponse>({
    queryKey: ["operations-emails", tab],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/emails", {
        query: { status: tab === "failure" ? "failure" : "all", limit: 50 },
      }),
  });

  const emails = data?.emails ?? [];

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-2 px-6 py-5">
        <div>
          <Heading>Odeslané e-maily</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
            Co jsme zákazníkům poslali a co se nepodařilo doručit. Nezdařený
            e-mail můžete poslat znovu.
          </Text>
        </div>
        <Button size="small" variant="secondary" asChild>
          <Link to="/prehled">Zpět na Přehled</Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <Tabs.List className="px-6 py-4">
          {tabs.map((entry) => (
            <Tabs.Trigger key={entry.key} value={entry.key}>
              {entry.label}
              {entry.key === "failure" && data?.failure_count
                ? ` (${data.failure_count})`
                : ""}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-y-3 px-6 text-center">
          <Heading level="h2">E-maily se nepodařilo načíst</Heading>
          <Button size="small" variant="secondary" onClick={() => refetch()}>
            Zkusit znovu
          </Button>
        </div>
      )}

      {!isLoading && !isError && emails.length === 0 && (
        <EmptyState
          title={
            tab === "failure"
              ? "Všechny e-maily odešly v pořádku"
              : "Zatím jsme neposlali žádný e-mail"
          }
          description={
            tab === "failure"
              ? "Kdyby se něco nepodařilo doručit, objeví se to tady."
              : "E-maily zákazníkům odcházejí automaticky podle toho, co se s objednávkou děje."
          }
        />
      )}

      {!isLoading && !isError && emails.length > 0 && (
        <div className="divide-y">
          {emails.map((email) => (
            <EmailRowItem key={email.id} email={email} />
          ))}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

/**
 * Přehled → Nezdařené e-maily (§22).
 *
 * Deliberately **no `config` export**: this is reached from the Přehled tile,
 * not from the sidebar, and a route without a label never becomes a nav item.
 *
 * The failure *reason* is not stored on the notification record — the module
 * keeps only a status — so it lives in the server log and in what „Poslat
 * znovu" reports back when the retry fails too.
 */
const EmailyPage = () => (
  <QueryClientProvider client={queryClient}>
    <EmailyInner />
  </QueryClientProvider>
);

export default EmailyPage;
