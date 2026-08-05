import {
  Badge,
  Button,
  Container,
  Heading,
  Label,
  Prompt,
  Skeleton,
  Table,
  Text,
  Textarea,
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
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { WorkTabs } from "../../../components/work-tabs";
import { formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

/**
 * Vrácení — the intake queue for customer return requests.
 *
 * The storefront's return form creates a request and the customer already got
 * a „přijali jsme" e-mail; this page is where she decides. Approving sends
 * „return-approved" with the atelier's return address, rejecting sends
 * „return-rejected" with her reason, verbatim — which is why the reason is
 * required and labelled as customer-visible.
 *
 * One deliberate warning in the copy: creating a *native* Medusa return on the
 * order detail sends its own „return-approved" under a different dedupe key,
 * so she should do one or the other, not both.
 */

type ReturnRequestRow = {
  id: string;
  order_id: string;
  order_display_id: string;
  email: string;
  customer_name: string | null;
  reason: string;
  items: string | null;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

type ListResponse = {
  return_requests: ReturnRequestRow[];
  count: number;
};

const RETURN_ADDRESS = "Keramická zahrada, Putim 229, 397 01 Písek";

const useDecide = (requestId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { decision: "approve" | "reject"; note?: string }) =>
      sdk.client.fetch(`/admin/return-requests/${requestId}/decide`, {
        method: "POST",
        body,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["return-requests"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Akci se nepodařilo provést"
      );
    },
  });
};

/** „Schválit" — a confirm, because it sends the customer an e-mail. */
const ApproveButton = ({ request }: { request: ReturnRequestRow }) => {
  const [open, setOpen] = useState(false);
  const mutation = useDecide(request.id);

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button size="small" variant="primary">
          Schválit
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>
            Schválit vrácení k objednávce #{request.order_display_id}?
          </Prompt.Title>
          <Prompt.Description>
            Zákazník dostane e-mail se schválením a adresou ateliéru pro
            zaslání zpět ({RETURN_ADDRESS}). Vrácení pak už nezakládejte znovu
            v detailu objednávky — odešel by druhý e-mail.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action
            onClick={() =>
              mutation.mutate(
                { decision: "approve" },
                {
                  onSuccess: () => {
                    toast.success(
                      "Žádost byla schválena — zákazníkovi jsme poslali e-mail s adresou pro vrácení"
                    );
                    setOpen(false);
                  },
                }
              )
            }
          >
            Schválit
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/**
 * „Zamítnout" — a small form, not a confirm: the reason is required because it
 * goes to the customer word for word.
 */
const RejectForm = ({
  request,
  onClose,
}: {
  request: ReturnRequestRow;
  onClose: () => void;
}) => {
  const [note, setNote] = useState("");
  const mutation = useDecide(request.id);
  const trimmed = note.trim();

  return (
    <form
      className="flex w-full flex-col gap-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed) {
          return;
        }
        mutation.mutate(
          { decision: "reject", note: trimmed },
          {
            onSuccess: () => {
              toast.success(
                "Žádost byla zamítnuta — zákazník dostal e-mail s důvodem"
              );
              onClose();
            },
          }
        );
      }}
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`reject-note-${request.id}`}>
          Důvod zamítnutí (zákazník ho uvidí)
        </Label>
        <Textarea
          id={`reject-note-${request.id}`}
          rows={3}
          placeholder="Objekt nese stopy používání, proto vrácení nemůžeme přijmout."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoFocus
        />
      </div>

      <Text size="small" className="text-ui-fg-subtle">
        Zákazníkovi odejde e-mail o zamítnutí a tento text v něm bude uveden
        jako důvod.
      </Text>

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="danger"
          type="submit"
          isLoading={mutation.isPending}
          disabled={!trimmed}
        >
          Zamítnout a poslat e-mail
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </form>
  );
};

const decidedMeta: Record<
  "approved" | "rejected",
  { label: string; color: "green" | "red" }
> = {
  approved: { label: "Schváleno", color: "green" },
  rejected: { label: "Zamítnuto", color: "red" },
};

const VraceniInner = () => {
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const pendingQuery = useQuery<ListResponse>({
    queryKey: ["return-requests", "pending"],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: { status: "pending", limit: 50 },
      }),
  });

  const decidedQuery = useQuery<ListResponse>({
    queryKey: ["return-requests", "decided"],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: { status: "decided", limit: 20 },
      }),
  });

  const pending = pendingQuery.data?.return_requests ?? [];
  const decided = decidedQuery.data?.return_requests ?? [];

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="vraceni" />

      <header className="px-6 pb-4 pt-6">
        <Heading>Vrácení</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Žádosti zákazníků o vrácení z e-shopu. Schválením odejde zákazníkovi
          e-mail s adresou ateliéru pro zaslání zpět, zamítnutím e-mail s vaším
          důvodem. Schválené vrácení pak nezakládejte znovu v detailu
          objednávky — poslal by se druhý e-mail; stačí jedno, nebo druhé.
        </Text>
      </header>

      {pendingQuery.isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {pendingQuery.isError && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-y-3 px-6 text-center">
          <Heading level="h2">Žádosti se nepodařilo načíst</Heading>
          <Button
            size="small"
            variant="secondary"
            onClick={() => pendingQuery.refetch()}
          >
            Zkusit znovu
          </Button>
        </div>
      )}

      {!pendingQuery.isLoading &&
        !pendingQuery.isError &&
        pending.length === 0 && (
          <EmptyState
            title="Žádné žádosti o vrácení nečekají"
            description="Jakmile zákazník požádá o vrácení přes e-shop, objeví se tady a dostanete upozornění e-mailem."
          />
        )}

      {!pendingQuery.isLoading && !pendingQuery.isError && pending.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Objednávka</Table.HeaderCell>
                <Table.HeaderCell>E-mail</Table.HeaderCell>
                <Table.HeaderCell>Důvod</Table.HeaderCell>
                <Table.HeaderCell>Datum</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {pending.map((request) => (
                <Fragment key={request.id}>
                  <Table.Row>
                    <Table.Cell>
                      <Button size="small" variant="transparent" asChild>
                        <Link to={`/orders/${request.order_id}`}>
                          #{request.order_display_id}
                        </Link>
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{request.email}</Text>
                      {request.customer_name && (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {request.customer_name}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell className="max-w-md">
                      <Text size="small" className="whitespace-normal">
                        {request.reason}
                      </Text>
                      {request.items && (
                        <Text
                          size="xsmall"
                          className="text-ui-fg-subtle whitespace-normal"
                        >
                          Objekty: {request.items}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {formatDateTime(request.created_at)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ApproveButton request={request} />
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() =>
                            setRejectingId(
                              rejectingId === request.id ? null : request.id
                            )
                          }
                        >
                          Zamítnout
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                  {rejectingId === request.id && (
                    <Table.Row>
                      {/* Plain <td>: Table.Cell's types omit colSpan. */}
                      <td colSpan={5} className="px-6 py-3">
                        <RejectForm
                          request={request}
                          onClose={() => setRejectingId(null)}
                        />
                      </td>
                    </Table.Row>
                  )}
                </Fragment>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <section className="px-6 py-5">
        <Heading level="h2">Nedávno rozhodnuté</Heading>
        {decidedQuery.isLoading && (
          <Skeleton className="mt-3 h-10 rounded-lg" />
        )}
        {!decidedQuery.isLoading && decided.length === 0 && (
          <Text size="small" className="text-ui-fg-muted mt-2">
            Zatím tu nic není — rozhodnuté žádosti se sem přesunou.
          </Text>
        )}
        {!decidedQuery.isLoading && decided.length > 0 && (
          <div className="mt-3 divide-y">
            {decided.map((request) => (
              <article
                key={request.id}
                className="grid gap-2 py-3 lg:grid-cols-[110px_110px_minmax(0,1fr)_150px] lg:items-center"
              >
                <Badge
                  size="2xsmall"
                  color={
                    decidedMeta[
                      request.status as "approved" | "rejected"
                    ]?.color ?? "grey"
                  }
                  className="w-fit"
                >
                  {decidedMeta[request.status as "approved" | "rejected"]
                    ?.label ?? request.status}
                </Badge>
                <Text size="small" className="text-ui-fg-subtle">
                  #{request.order_display_id}
                </Text>
                <div className="min-w-0">
                  <Text size="small" className="text-ui-fg-subtle truncate">
                    {request.email} — {request.reason}
                  </Text>
                  {request.decision_note && (
                    <Text size="xsmall" className="text-ui-fg-muted truncate">
                      Poznámka: {request.decision_note}
                    </Text>
                  )}
                </div>
                <Text size="small" className="text-ui-fg-muted lg:text-right">
                  {formatDateTime(request.decided_at ?? request.created_at)}
                </Text>
              </article>
            ))}
          </div>
        )}
      </section>

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const VraceniPage = () => (
  <QueryClientProvider client={queryClient}>
    <VraceniInner />
  </QueryClientProvider>
);

export default VraceniPage;
