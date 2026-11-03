import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  clx,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PhotoGallery } from "../../../components/claims/photo-lightbox";
import { EmptyState } from "../../../components/empty-state";
import { SubTabs, WorkTabs } from "../../../components/work-tabs";
import { ceskaChyba } from "../../../lib/ceska-chyba";
import { formatDateTime } from "../../../lib/format";
import { adminQueryClient } from "../../../lib/query-client";
import { sdk } from "../../../lib/sdk";

/**
 * Poptávky zakázek — co lidé poslali formulářem „Výroba na zakázku".
 *
 * Dřív poptávka přišla jen e-mailem a do zvonku a v administraci nebyla
 * nikde. Tady je seznam s tím nejnutnějším: kdo, co chce, fotky, kdy — a
 * stav na jedno kliknutí (Nová → Odpovězeno → Vyřízeno), ať je vidět, na co
 * ještě nikdo neodpověděl. Nic víc schválně: odpovídá se e-mailem, nabídka
 * a cena jsou na ní.
 *
 * **Bez položky v menu** — odkaz vede z Přehledu (počet nových dává
 * `GET /admin/commission-inquiries/counts`).
 */

type InquiryStatus = "new" | "answered" | "done";

type Inquiry = {
  id: string;
  received_at: string;
  status: InquiryStatus;
  name: string;
  email: string;
  phone: string | null;
  description: string;
  dimensions: string | null;
  motif: string | null;
  deadline: string | null;
  product_title: string | null;
  product_url: string | null;
  photo_urls: string[];
  photos_failed: number;
};

type InquiriesResponse = {
  inquiries: Inquiry[];
  counts: Record<InquiryStatus, number>;
};

const STATUS_STEPS: Array<{ key: InquiryStatus; label: string }> = [
  { key: "new", label: "Nová" },
  { key: "answered", label: "Odpovězeno" },
  { key: "done", label: "Vyřízeno" },
];

const tabs = [
  { key: "otevrene", label: "K vyřízení" },
  { key: "vyrizene", label: "Vyřízené" },
] as const;

/** „1 fotka / 3 fotky / 5 fotek" — stejné jako v e-mailu majitelce. */
const photoCount = (count: number): string => {
  if (count === 1) return "1 fotka";
  if (count >= 2 && count <= 4) return `${count} fotky`;
  return `${count} fotek`;
};

/** Odpověď z vlastní pošty; předmět ať zákazník pozná, na co se odpovídá. */
const replyHref = (inquiry: Inquiry): string => {
  const subject = inquiry.product_title
    ? `Vaše poptávka — ${inquiry.product_title}`
    : "Vaše poptávka zakázky";
  // Adresa bez kódování: ověřil ji už formulář a některé poštovní programy
  // „%40" místo zavináče nepřečtou.
  return `mailto:${inquiry.email}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent("Dobrý den,\n\n")}`;
};

const Detail = ({ label, value }: { label: string; value: string | null }) =>
  value ? (
    <Text size="small">
      <span className="text-ui-fg-muted">{label}: </span>
      {value}
    </Text>
  ) : null;

const StatusButtons = ({ inquiry }: { inquiry: Inquiry }) => {
  const queryClient = useQueryClient();

  const change = useMutation({
    mutationFn: (status: InquiryStatus) =>
      sdk.client.fetch(`/admin/commission-inquiries/${inquiry.id}/status`, {
        method: "POST",
        body: { status },
      }),
    onSuccess: async (_data, status) => {
      await queryClient.invalidateQueries({ queryKey: ["commission-inquiries"] });
      toast.success(
        status === "done" ? "Přesunuto mezi vyřízené" : "Uloženo"
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Stav se nepodařilo uložit")),
  });

  return (
    <div
      role="group"
      aria-label="Stav poptávky"
      className="flex flex-wrap items-center gap-2"
    >
      {STATUS_STEPS.map((step) => {
        const isActive = step.key === inquiry.status;
        return (
          <Button
            key={step.key}
            size="small"
            variant={isActive ? "primary" : "secondary"}
            aria-pressed={isActive}
            disabled={change.isPending}
            onClick={() => {
              if (!isActive) change.mutate(step.key);
            }}
          >
            {step.label}
          </Button>
        );
      })}
    </div>
  );
};

const InquiryCard = ({ inquiry }: { inquiry: Inquiry }) => (
  <article
    className={clx(
      "grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto]",
      inquiry.status === "done" && "opacity-80"
    )}
  >
    <div className="flex min-w-0 flex-col gap-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Text size="base" weight="plus">
          {inquiry.name || "Bez jména"}
        </Text>
        {inquiry.status === "new" && (
          <Badge size="2xsmall" color="orange">
            Nová
          </Badge>
        )}
        <Text size="small" className="text-ui-fg-muted">
          {formatDateTime(inquiry.received_at)}
        </Text>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <a
          href={`mailto:${inquiry.email}`}
          className="text-ui-fg-interactive break-all text-sm"
        >
          {inquiry.email}
        </a>
        {inquiry.phone && (
          <a href={`tel:${inquiry.phone.replace(/\s+/g, "")}`} className="text-ui-fg-interactive text-sm">
            {inquiry.phone}
          </a>
        )}
      </div>

      {inquiry.product_title && (
        <Text size="small">
          <span className="text-ui-fg-muted">K výrobku: </span>
          {inquiry.product_url ? (
            <a
              href={inquiry.product_url}
              target="_blank"
              rel="noreferrer"
              className="text-ui-fg-interactive"
            >
              {inquiry.product_title}
            </a>
          ) : (
            inquiry.product_title
          )}
        </Text>
      )}

      <Text size="small" className="whitespace-pre-line break-words">
        {inquiry.description}
      </Text>

      {(inquiry.dimensions || inquiry.motif || inquiry.deadline) && (
        <div className="flex flex-col gap-y-1">
          <Detail label="Rozměry" value={inquiry.dimensions} />
          <Detail label="Motiv / text / číslo" value={inquiry.motif} />
          <Detail label="Termín" value={inquiry.deadline} />
        </div>
      )}

      <PhotoGallery photos={inquiry.photo_urls} />
      {inquiry.photos_failed > 0 && (
        <Text size="small" className="text-ui-fg-error">
          {photoCount(inquiry.photos_failed)} se nepodařilo uložit — požádejte
          zákazníka, ať je pošle e-mailem.
        </Text>
      )}
    </div>

    <div className="flex flex-col items-start gap-y-3 lg:items-end">
      <Button size="small" variant={inquiry.status === "new" ? "primary" : "secondary"} asChild>
        <a href={replyHref(inquiry)}>Odpovědět e-mailem</a>
      </Button>
      <StatusButtons inquiry={inquiry} />
    </div>
  </article>
);

const PoptavkyInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = tabs.find((tab) => tab.key === searchParams.get("stav")) ?? tabs[0];

  const { data, isLoading, isError } = useQuery<InquiriesResponse>({
    queryKey: ["commission-inquiries"],
    queryFn: () => sdk.client.fetch("/admin/commission-inquiries"),
    refetchOnWindowFocus: true,
  });

  const all = data?.inquiries ?? [];
  const shown = all.filter((inquiry) =>
    active.key === "vyrizene" ? inquiry.status === "done" : inquiry.status !== "done"
  );
  const counts = data?.counts;

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="zakazky" />

      <header className="px-6 pb-2 pt-6">
        <Heading>Poptávky zakázek</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Co lidé poslali formulářem „Výroba na zakázku". Odpovězte e-mailem a
          pak jedním kliknutím označte, jak to s poptávkou je.
        </Text>
      </header>

      <SubTabs
        active={active.key}
        onSelect={(key) =>
          setSearchParams(key === tabs[0].key ? {} : { stav: key }, { replace: true })
        }
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count:
            tab.key === "otevrene" && counts ? counts.new + counts.answered : undefined,
        }))}
      />

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Poptávky se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && shown.length === 0 && (
        <EmptyState
          title={
            active.key === "vyrizene" ? "Zatím nic vyřízeného" : "Žádná poptávka nečeká"
          }
          description={
            active.key === "vyrizene"
              ? "Sem se přesunou poptávky, které označíte jako vyřízené."
              : "Nová poptávka se tu objeví hned, jak ji někdo odešle. Přijde i e-mailem."
          }
        />
      )}

      {!isLoading && !isError && shown.length > 0 && (
        <div className="divide-y">
          {shown.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      )}

    </Container>
  );
};

const PoptavkyPage = () => (
  <QueryClientProvider client={adminQueryClient}>
    <PoptavkyInner />
  </QueryClientProvider>
);

export default PoptavkyPage;
