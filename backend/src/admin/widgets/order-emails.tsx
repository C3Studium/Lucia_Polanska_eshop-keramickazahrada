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
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client"
import { ceskaChyba, ceskyText } from "../lib/ceska-chyba";

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
  "commission-confirmed": "Zadání potvrzeno",
  "order-processing": "Výroba začala",
  "commission-completed": "Zakázka hotová",
  "order-refunded": "Objednávka vrácena",
  "order-review": "Prosba o recenzi",
  "order-ready-pickup": "Připraveno k vyzvednutí",
  "order-delivered": "Zásilka doručena",
  "order-delayed": "Výroba se protáhne",
  "order-preparing": "Připravujeme",
  "order-ready": "Připraveno k odeslání",
  "invoice-issued": "Faktura",
  "surcharge-confirmed": "Potvrzení příplatku",
  "commission-message": "Zpráva k zakázce",
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
        toast.error(ceskyText(result.message, "Odeslat znovu se nepodařilo"));
      }
    },
    onError: (error) => toast.error(ceskaChyba(error, "Akci se nepodařilo dokončit.")),
  });

  /*
   * „Výzva k zaplacení" — ruční, a schválně.
   *
   * Platba se nepovede častěji, než by člověk čekal: vyprší relace u brány,
   * zákazník zavře záložku, banka zamítne. Objednávka existuje, zboží je
   * odložené a chybí jen peníze. Automatika na to není a být nemá —
   * rozhodnutí „tuhle objednávku chci ještě zachránit" je obchodní, ne
   * technické, a u stornované obzvlášť.
   *
   * Tlačítko stojí tady, ne v tabulce plateb: po odeslání je výzva jedním
   * z řádků v seznamu pod ním, takže je hned vidět, že odešla.
   */
  const vyzva = useMutation<
    { sent: boolean; warning?: string | null },
    Error,
    void
  >({
    mutationFn: () =>
      sdk.client.fetch(
        `/admin/merchant-orders/${order.id}/payment-request`,
        { method: "POST" }
      ),
    onSuccess: async (result) => {
      if (result.warning) {
        /* Varování, ne chyba: e-mail odešel. */
        toast.warning(result.warning);
      } else if (result.sent) {
        toast.success("Výzva k zaplacení odeslána");
      } else {
        toast.error("Výzvu se nepodařilo odeslat");
      }
      await queryClient.invalidateQueries({ queryKey: ["order-emails"] });
    },
    onError: (error) => toast.error(ceskaChyba(error, "Akci se nepodařilo dokončit.")),
  });

  /*
   * Doposlání potvrzení smlouvy.
   *
   * Potvrzení objednávky nikdy nečeká na PDF — když se dokument nepovede,
   * e-mail odejde bez přílohy a chyba jde jen do logu. Tohle je ta ruční
   * náprava: dokument se vyrobí znovu a odejde samostatným e-mailem.
   */
  const smlouva = useMutation<
    { sent: boolean; documents: { filename: string; url: string }[] },
    Error,
    void
  >({
    mutationFn: () =>
      sdk.client.fetch(`/admin/orders/${order.id}/contract`, { method: "POST" }),
    onSuccess: async (result) => {
      toast.success(
        result.documents.length > 1
          ? `Odesláno ${result.documents.length} potvrzení smlouvy.`
          : "Potvrzení smlouvy odesláno."
      );
      await queryClient.invalidateQueries({ queryKey: ["order-emails"] });
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Potvrzení se nepodařilo doposlat.")),
  });

  const emails = data?.emails ?? [];

  /* Dorazilo potvrzení objednávky s dokumentem? Když ne, tlačítko to
     nenápadně připomene — jinak je to jen náprava na vyžádání. */
  const potvrzeniOdeslano = emails.some(
    (email) => email.template === "order-placed" && email.status === "success"
  );

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h2">Odeslané e-maily</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Co zákazník o této objednávce dostal.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            isLoading={smlouva.isPending}
            title={
              potvrzeniOdeslano
                ? "Vyrobí dokument znovu a pošle ho samostatným e-mailem."
                : "Potvrzení objednávky zatím neodešlo — zkontrolujte seznam níž."
            }
            onClick={() => smlouva.mutate()}
          >
            Doposlat potvrzení smlouvy
          </Button>
          <Button
            size="small"
            variant="secondary"
            isLoading={vyzva.isPending}
            onClick={() => vyzva.mutate()}
          >
            Poslat výzvu k zaplacení
          </Button>
        </div>
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

const queryClient = adminQueryClient;

const OrderEmailsWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <OrderEmailsInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  // Odeslané e-maily patří k „Aktivitě" → do pravého baru, ne na konec hlavního
  // sloupce. (Majitelčino přání — přehlednější workflow.)
  zone: "order.details.side.after",
  id: "keramicka-zahrada:order-emails",
});

export default OrderEmailsWidget;
