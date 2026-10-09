import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isCeskaPosta, isPersonalPickup } from "../lib/cp-shipping";
import { formatDate, formatDateTime } from "../lib/format";
import { adminQueryClient } from "../lib/query-client";
import { sdk } from "../lib/sdk";

const queryClient = adminQueryClient;

// ---------------------------------------------------------------------------
// Tvary API podle docs/sledovani-zasilek.md §5 (route se staví zvlášť; widget
// se opírá jen o tenhle kontrakt).
// ---------------------------------------------------------------------------

type TrackingPhase =
  | "label"
  | "handed_over"
  | "in_transit"
  | "stored"
  | "delivered"
  | "returned"
  | "problem";

type TrackingEvent = {
  id: string;
  text: string;
  /** Jen datum `YYYY-MM-DD` — ČP přesnější razítko nedává. */
  date: string;
  postoffice?: string | null;
  postcode?: string | null;
  source: "cp" | "simulated";
  seen_at: string;
};

type ParcelTracking = {
  id: string;
  order_id: string;
  carrier: string;
  parcel_code: string;
  service_code: string | null;
  phase: TrackingPhase;
  events: TrackingEvent[];
  handed_over_at: string | null;
  stored_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  last_state_id: string | null;
  last_state_text: string | null;
  last_checked_at: string | null;
  check_count: number;
  done: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type TrackingResponse = {
  tracking: ParcelTracking | null;
  /** Z metadat objednávky — i když záznam sledování ještě neexistuje. */
  parcel_code: string | null;
  tracking_url: string | null;
  simulate_allowed: boolean;
  carrier_label: string;
};

type SimulateState = "21" | "75" | "82" | "91" | "95" | "8E";

type TrackingAction =
  | { action: "start" }
  | { action: "refresh" }
  | { action: "simulate"; state: SimulateState };

// ---------------------------------------------------------------------------
// Překlady fází a stavů
// ---------------------------------------------------------------------------

type BadgeColor = "grey" | "blue" | "orange" | "green" | "red";

const PHASE_META: Record<TrackingPhase, { label: string; color: BadgeColor }> = {
  label: { label: "Štítek", color: "grey" },
  handed_over: { label: "Předáno dopravci", color: "blue" },
  in_transit: { label: "Na cestě", color: "blue" },
  stored: { label: "Uloženo k vyzvednutí", color: "orange" },
  delivered: { label: "Převzato zákazníkem", color: "green" },
  returned: { label: "Vráceno", color: "red" },
  problem: { label: "Problém se zásilkou", color: "red" },
};

/** Tlačítka simulace — kód stavu ČP + jak se mu říká v číselníku (§1). */
const SIMULATE_STATES: Array<{ state: SimulateState; label: string }> = [
  { state: "21", label: "Předáno dopravci" },
  { state: "75", label: "Na cestě" },
  { state: "82", label: "Uloženo" },
  { state: "91", label: "Doručeno" },
  { state: "95", label: "Vráceno" },
  { state: "8E", label: "Poškozeno" },
];

/** Stavy ČP, které znamenají „na cestě" — pro datum kroku bez vlastního `*_at`. */
const IN_TRANSIT_STATE_IDS = new Set(["75", "51", "8D", "8T"]);

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

type StepState = "done" | "current" | "upcoming" | "skipped";

type Step = {
  label: string;
  at: string | null;
  state: StepState;
};

/** Index kroku, kam zásilka reálně došla — podle razítek, ne podle fáze. */
const reachedIndex = (tracking: ParcelTracking): number => {
  if (tracking.delivered_at) return 4;
  if (tracking.stored_at) return 3;
  if (tracking.events.some((event) => IN_TRANSIT_STATE_IDS.has(event.id))) {
    return 2;
  }
  if (tracking.handed_over_at) return 1;
  return 0;
};

const buildSteps = (tracking: ParcelTracking): Step[] => {
  const inTransitAt =
    tracking.events.find((event) => IN_TRANSIT_STATE_IDS.has(event.id))?.date ??
    null;
  const dates: Array<string | null> = [
    tracking.created_at,
    tracking.handed_over_at,
    inTransitAt,
    tracking.stored_at,
    tracking.delivered_at,
  ];
  const labels = [
    "Štítek",
    "Předáno dopravci",
    "Na cestě",
    "Uloženo k vyzvednutí",
    "Převzato zákazníkem",
  ];

  const reached = reachedIndex(tracking);
  // Vrácená / poškozená zásilka: hotové kroky zůstanou plné, ale „aktuální"
  // krok žádný není — ten říká červený řádek pod stepperem.
  const sideTracked =
    tracking.phase === "returned" || tracking.phase === "problem";
  const finished = tracking.phase === "delivered";

  return labels.map((label, index) => {
    let state: StepState;
    if (index < reached) {
      // Doručeno bez uložení (Balík Do ruky) — krok „uloženo" se nekonal.
      state = finished && index === 3 && !tracking.stored_at ? "skipped" : "done";
    } else if (index === reached) {
      state = finished || sideTracked ? "done" : "current";
    } else {
      state = "upcoming";
    }
    return { label, at: dates[index], state };
  });
};

const DOT_CLASS: Record<StepState, string> = {
  done: "bg-ui-tag-green-icon",
  current: "bg-ui-tag-orange-icon",
  upcoming: "bg-ui-border-strong",
  skipped: "bg-ui-border-base",
};

const Stepper = ({ steps }: { steps: Step[] }) => (
  <ol className="flex flex-col gap-y-2">
    {steps.map((step, index) => (
      <li key={index} className="flex items-start gap-x-3">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[step.state]}`}
        />
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-x-3">
          <Text
            size="small"
            weight={step.state === "current" ? "plus" : "regular"}
            className={
              step.state === "upcoming" || step.state === "skipped"
                ? "text-ui-fg-muted"
                : ""
            }
          >
            {step.label}
            {step.state === "skipped" ? " (nebylo třeba)" : ""}
          </Text>
          {step.at && (
            <Text size="xsmall" className="text-ui-fg-subtle shrink-0">
              {formatDate(step.at)}
            </Text>
          )}
        </div>
      </li>
    ))}
  </ol>
);

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

/**
 * Sledování zásilky u České pošty na detailu objednávky (pod štítkem).
 *
 * Záznam vzniká sám po vygenerování štítku; u starších objednávek s číslem
 * zásilky v metadatech se zapne tlačítkem „Začít sledovat". Stavy chodí
 * z veřejného JSON ČP přes job každou půlhodinu — „Zkontrolovat teď" se
 * zeptá hned. V testovacím prostředí (`simulate_allowed`) jde stav podstrčit:
 * simulace jde STEJNOU cestou jako ostrý stav, tedy i e-mail zákazníkovi
 * („předáno dopravci") a změna fáze objednávky. Jen pro zásilky ČP; osobní
 * odběr a jiní dopravci widget skryjí (docs/sledovani-zasilek.md §7).
 */
const CpTrackingWidgetInner = ({ order }: { order: AdminOrder }) => {
  const queryClient = useQueryClient();

  // Sdílené se štítkem (lib/cp-shipping.ts), ať se oba widgety shodnou.
  const ceskaPosta = isCeskaPosta(order);
  const personalPickup = isPersonalPickup(order);
  const relevant = ceskaPosta && !personalPickup;

  const trackingQuery = useQuery<TrackingResponse>({
    queryKey: ["cp-tracking", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/tracking`, {
        method: "GET",
      }),
    retry: false,
    enabled: relevant,
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cp-tracking", order.id] }),
      queryClient.invalidateQueries({ queryKey: ["cp-label", order.id] }),
      queryClient.invalidateQueries({ queryKey: ["merchant-order", order.id] }),
      // Skutečné klíče stavu objednávky v této administraci — po simulovaném
      // „předáno dopravci" se mění fáze na „Odesláno".
      queryClient.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] }),
    ]);
  };

  const act = useMutation<TrackingResponse, Error, TrackingAction>({
    mutationFn: (body) =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/tracking`, {
        method: "POST",
        body,
      }),
    onSuccess: async (result, variables) => {
      await invalidateAll();
      const last = result.tracking?.last_state_text;
      switch (variables.action) {
        case "start":
          toast.success("Zásilka se sleduje — stav se zkontroluje každou půlhodinu.");
          break;
        case "refresh":
          toast.success(
            last ? `Zkontrolováno u ČP: ${last}` : "Zkontrolováno u ČP — zatím beze změny."
          );
          break;
        case "simulate": {
          const label =
            SIMULATE_STATES.find((item) => item.state === variables.state)
              ?.label ?? variables.state;
          toast.success(`Simulace „${label}" proběhla stejnou cestou jako ostrý stav.`);
          break;
        }
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Akce se u sledování zásilky nepodařila."
      ),
  });

  const pendingAction = act.isPending ? act.variables : undefined;
  const isPending = (predicate: (action: TrackingAction) => boolean) =>
    pendingAction !== undefined && predicate(pendingAction);

  // Osobní odběr ani cizí dopravce tu nemají co dělat.
  if (!relevant) {
    return null;
  }

  const data = trackingQuery.data;
  const tracking = data?.tracking ?? null;
  const parcelCode = tracking?.parcel_code ?? data?.parcel_code ?? null;
  const phaseMeta = tracking ? PHASE_META[tracking.phase] : null;
  const steps = tracking ? buildSteps(tracking) : [];
  const lastEvent = tracking?.events.length
    ? tracking.events[tracking.events.length - 1]
    : null;
  const sideTracked =
    tracking?.phase === "returned" || tracking?.phase === "problem";

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Zásilka u České pošty</Heading>
        {phaseMeta ? (
          <Badge color={phaseMeta.color}>{phaseMeta.label}</Badge>
        ) : (
          <Badge color="grey">Nesleduje se</Badge>
        )}
      </div>

      <div className="flex flex-col gap-y-4 px-6 py-4">
        {trackingQuery.isLoading && <Skeleton className="h-24 rounded-lg" />}

        {trackingQuery.isError && !trackingQuery.isLoading && (
          <Text size="small" className="text-ui-fg-error">
            {trackingQuery.error instanceof Error && trackingQuery.error.message
              ? trackingQuery.error.message
              : "Stav sledování se nepodařilo načíst."}
          </Text>
        )}

        {!trackingQuery.isLoading && data && (
          <>
            {/* Bez záznamu i bez čísla zásilky — nic k sledování. */}
            {!tracking && !parcelCode && (
              <Text size="small" className="text-ui-fg-subtle">
                Sledování začne po vygenerování štítku.
              </Text>
            )}

            {/* Číslo zásilky je, záznam ne (starší objednávka) — zapnout ručně. */}
            {!tracking && parcelCode && (
              <div className="flex flex-col gap-y-3">
                <ParcelCode code={parcelCode} trackingUrl={data.tracking_url} />
                <Text size="small" className="text-ui-fg-subtle">
                  Objednávka má číslo zásilky, ale ještě se nesleduje.
                </Text>
                <div>
                  <Button
                    size="small"
                    variant="primary"
                    isLoading={isPending((a) => a.action === "start")}
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: "start" })}
                  >
                    Začít sledovat
                  </Button>
                </div>
              </div>
            )}

            {tracking && (
              <div className="flex flex-col gap-y-4">
                <Stepper steps={steps} />

                {/* Vrácená / poškozená zásilka — mimo normální cestu. */}
                {sideTracked && (
                  <div className="border-ui-tag-red-border bg-ui-tag-red-bg rounded-lg border px-3 py-2">
                    <Text size="small" weight="plus" className="text-ui-tag-red-text">
                      {tracking.phase === "returned"
                        ? "Zásilka se vrací / vrátila"
                        : "ČP hlásí problém se zásilkou"}
                    </Text>
                    <Text size="xsmall" className="text-ui-tag-red-text">
                      {tracking.last_state_text ?? lastEvent?.text ?? "Bez bližšího popisu."}
                      {tracking.returned_at
                        ? ` · ${formatDate(tracking.returned_at)}`
                        : lastEvent?.date
                          ? ` · ${formatDate(lastEvent.date)}`
                          : ""}
                    </Text>
                  </div>
                )}

                {/* Poslední stav ČP */}
                {(tracking.last_state_text || lastEvent) && (
                  <div>
                    <Text size="xsmall" className="text-ui-fg-muted uppercase">
                      Poslední stav ČP
                    </Text>
                    <Text size="small" className="mt-1">
                      {tracking.last_state_text ?? lastEvent?.text}
                      {lastEvent?.date ? ` · ${formatDate(lastEvent.date)}` : ""}
                      {lastEvent?.postoffice ? ` · ${lastEvent.postoffice}` : ""}
                      {lastEvent?.source === "simulated" ? " (simulace)" : ""}
                    </Text>
                  </div>
                )}

                <ParcelCode code={tracking.parcel_code} trackingUrl={data.tracking_url} />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="small"
                    variant="secondary"
                    isLoading={isPending((a) => a.action === "refresh")}
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: "refresh" })}
                  >
                    Zkontrolovat teď
                  </Button>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {tracking.last_checked_at
                      ? `Naposledy zkontrolováno ${formatDateTime(tracking.last_checked_at)}`
                      : "Zatím nekontrolováno"}
                    {tracking.done ? " · sledování ukončeno" : ""}
                  </Text>
                </div>

                {tracking.note && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Poznámka: {tracking.note}
                  </Text>
                )}

                {data.simulate_allowed && (
                  <div className="border-ui-border-base flex flex-col gap-y-2 rounded-lg border border-dashed px-3 py-3">
                    <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                      Simulace (testovací prostředí)
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {SIMULATE_STATES.map((item) => (
                        <Button
                          key={item.state}
                          size="small"
                          variant="transparent"
                          isLoading={isPending(
                            (a) => a.action === "simulate" && a.state === item.state
                          )}
                          disabled={act.isPending}
                          onClick={() =>
                            act.mutate({ action: "simulate", state: item.state })
                          }
                        >
                          {item.label} ({item.state})
                        </Button>
                      ))}
                    </div>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Simulace projde stejnou cestou jako ostrý stav z ČP — odejde
                      e-mail zákazníkovi a změní se fáze objednávky.
                    </Text>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
};

/** Číslo zásilky + odkaz na sledování u ČP. */
const ParcelCode = ({
  code,
  trackingUrl,
}: {
  code: string;
  trackingUrl: string | null;
}) => (
  <div>
    <Text size="xsmall" className="text-ui-fg-muted uppercase">
      Číslo zásilky
    </Text>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
      <Text size="small" weight="plus">
        {code}
      </Text>
      {trackingUrl && (
        <a
          href={trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="text-ui-fg-interactive txt-small hover:underline"
        >
          Sledovat u ČP
        </a>
      )}
    </div>
  </div>
);

const CpTrackingWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <CpTrackingWidgetInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "keramicka-zahrada:cp-tracking",
});

export default CpTrackingWidget;
