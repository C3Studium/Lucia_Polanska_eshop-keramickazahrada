import { defineRouteConfig } from "@medusajs/admin-sdk";
import { AcademicCap } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Prompt,
  Select,
  Skeleton,
  Switch,
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
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../lib/expert-mode";
import { SubTabs } from "../../components/work-tabs";
import { formatCzk } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";
import {
  CZECH_WEEKLY_PHRASES,
  MAX_OCCURRENCES,
  horizonEndDayKey,
  planWeeklyOccurrences,
  type RepeatHorizon,
} from "../../../modules/course/recurrence";
import {
  type CalendarMonth,
  CZECH_WEEKDAYS,
  addMonths,
  buildMonthGrid,
  dayLabel,
  groupByPragueDay,
  mondayIndex,
  monthTitle,
  parseDayKey,
  pragueDayKey,
  pragueMonthOf,
} from "../../lib/course-calendar";

/**
 * Kurzy — terms and reservations in one place (docs/kurzy-system.md).
 *
 * Terms carry the whole pricing story (za jednoho / za dva / skupina od X),
 * reservations carry the people. Every write goes through
 * `/admin/courses/*`; capacity is enforced server-side, so this page never
 * has to reason about races — it just shows what the server said.
 */

type AdminReservation = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  pricing_tier: "single" | "pair" | "group";
  total_price: number;
  payment_method: "online" | "on_site";
  payment_status: "pending" | "paid" | "on_site";
  paid_at: string | null;
  status: "active" | "cancelled";
  cancel_reason: "auto_expired" | "manual" | "term_cancelled" | "customer" | null;
  refunded_at: string | null;
  source: "web" | "manual";
  note: string | null;
  created_at: string;
};

type AdminWaitlistEntry = {
  id: string;
  name: string;
  email: string | null;
  party_size: number;
  notified_at: string | null;
  created_at: string;
};

type AdminTerm = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  duration_minutes: number | null;
  capacity: number;
  seats_taken: number;
  seats_left: number;
  price_single: number;
  price_two: number | null;
  group_min: number | null;
  price_group_per_person: number | null;
  status: "draft" | "published" | "cancelled" | "finished";
  note: string | null;
  reservations: AdminReservation[];
  waitlist: AdminWaitlistEntry[];
  waitlist_waiting: number;
};

const queryClient = new QueryClient();

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Always Europe/Prague, whatever timezone the browser happens to be in. */
const formatPrague = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/** Just the Prague date — „24. 11. 2026". */
const formatPragueDate = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value));

/** Just the Prague wall-clock time — „17:00". */
const formatPragueTime = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const termsCountLabel = (count: number): string =>
  count === 1 ? "1 termín" : count < 5 ? `${count} termíny` : `${count} termínů`;

const formatDuration = (minutes: number | null): string => {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const people = (count: number): string =>
  `${count} ${count === 1 ? "osoba" : count < 5 ? "osoby" : "osob"}`;

/** UTC ISO → value for `<input type="datetime-local">` in the browser's zone. */
const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const TERM_STATUS: Record<
  AdminTerm["status"],
  { label: string; color: "green" | "grey" | "red" | "blue" }
> = {
  draft: { label: "Koncept", color: "grey" },
  published: { label: "Vypsaný", color: "green" },
  cancelled: { label: "Zrušený", color: "red" },
  finished: { label: "Proběhlý", color: "blue" },
};

const TIER_LABEL: Record<AdminReservation["pricing_tier"], string> = {
  single: "za jednoho",
  pair: "za dva",
  group: "skupina",
};

/** Why the row is cancelled, in words — automatic expiries stand apart. */
const cancelReasonLabel = (reservation: AdminReservation): string => {
  switch (reservation.cancel_reason) {
    case "auto_expired":
      return "zrušeno — nezaplaceno (automaticky)";
    case "term_cancelled":
      return "zrušeno se zrušením termínu";
    case "manual":
      return "zrušeno ručně";
    case "customer":
      return "zrušil zákazník";
    default:
      return "zrušena";
  }
};

/** What still has to happen with the money on a cancelled paid row. */
const cancelledMoneyLabel = (reservation: AdminReservation): string | null => {
  if (reservation.payment_status !== "paid") {
    return null;
  }
  return reservation.refunded_at
    ? "peníze vráceny na kartu"
    : "vrátit peníze ručně";
};

const paymentBadge = (reservation: AdminReservation) => {
  if (reservation.status === "cancelled") {
    return <Badge color="grey">Zrušená</Badge>;
  }
  if (reservation.payment_status === "paid") {
    return <Badge color="green">Zaplaceno kartou</Badge>;
  }
  if (reservation.payment_method === "online") {
    return <Badge color="orange">Čeká na platbu</Badge>;
  }
  return <Badge color="blue">Zaplatí na místě</Badge>;
};

/** Server errors carry Czech, admin-ready messages; transport internals do not. */
const errorMessage = async (error: unknown, fallback: string) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "").trim()
      : "";
  const looksInternal =
    !message ||
    message.length < 4 ||
    /internal|unauthorized|forbidden|fetch|network|unexpected|error/i.test(
      message
    );
  return looksInternal ? fallback : message;
};

/* ------------------------------------------------------------------ */
/* Term editor (create + edit)                                         */
/* ------------------------------------------------------------------ */

type TermDraft = {
  title: string;
  location: string;
  starts_at_local: string;
  duration_minutes: string;
  capacity: string;
  price_single: string;
  price_two: string;
  group_min: string;
  price_group_per_person: string;
  status: "draft" | "published" | "finished";
  note: string;
};

const emptyDraft: TermDraft = {
  title: "",
  location: "Ateliér u Písku",
  starts_at_local: "",
  duration_minutes: "180",
  capacity: "8",
  price_single: "",
  price_two: "",
  group_min: "",
  price_group_per_person: "",
  status: "published",
  note: "",
};

const draftFromTerm = (term: AdminTerm): TermDraft => ({
  title: term.title,
  location: term.location,
  starts_at_local: toLocalInput(term.starts_at),
  duration_minutes: term.duration_minutes ? String(term.duration_minutes) : "",
  capacity: String(term.capacity),
  price_single: String(term.price_single),
  price_two: term.price_two != null ? String(term.price_two) : "",
  group_min: term.group_min != null ? String(term.group_min) : "",
  price_group_per_person:
    term.price_group_per_person != null
      ? String(term.price_group_per_person)
      : "",
  status: term.status === "cancelled" ? "draft" : term.status,
  note: term.note ?? "",
});

const draftToPayload = (draft: TermDraft) => {
  const number = (value: string) =>
    value.trim() === "" ? null : Number(value.replace(",", "."));
  return {
    title: draft.title.trim(),
    location: draft.location.trim(),
    starts_at: draft.starts_at_local
      ? new Date(draft.starts_at_local).toISOString()
      : "",
    duration_minutes: number(draft.duration_minutes),
    capacity: Number(draft.capacity),
    price_single: number(draft.price_single) ?? -1,
    price_two: number(draft.price_two),
    group_min: number(draft.group_min),
    price_group_per_person: number(draft.price_group_per_person),
    status: draft.status,
    note: draft.note.trim() || null,
  };
};

/** Czech reasons the term can't be saved yet — shown instead of a mute button. */
const draftProblems = (draft: TermDraft): string[] => {
  const payload = draftToPayload(draft);
  const problems: string[] = [];
  if (!payload.title.length) {
    problems.push("Chybí název kurzu.");
  }
  if (!payload.location.length) {
    problems.push("Chybí místo konání.");
  }
  if (!payload.starts_at.length) {
    problems.push("Chybí datum a čas začátku.");
  }
  if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
    problems.push("Kapacita musí být aspoň 1 osoba.");
  }
  if (payload.price_single == null || payload.price_single < 0) {
    problems.push("Chybí cena za jednoho.");
  }
  if ((payload.group_min == null) !== (payload.price_group_per_person == null)) {
    problems.push(
      "Skupinová cena potřebuje obojí: od kolika lidí platí i kolik zaplatí osoba."
    );
  }
  return problems;
};

const draftIsValid = (draft: TermDraft): boolean =>
  draftProblems(draft).length === 0;

/**
 * The three price tiers restated as arithmetic. Labels alone leave room for
 * „za dva = cena dohromady?" — a worked example does not.
 */
const pricingExampleLines = (draft: TermDraft): string[] => {
  const number = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const lines: string[] = [];
  const single = number(draft.price_single);
  if (single != null) {
    lines.push(`Jeden sám zaplatí ${formatCzk(single)}.`);
  }
  const two = number(draft.price_two);
  if (two != null) {
    lines.push(
      `Dva spolu zaplatí 2 × ${formatCzk(two)} = ${formatCzk(two * 2)} dohromady.`
    );
  }
  const groupMin = number(draft.group_min);
  const groupPrice = number(draft.price_group_per_person);
  if (groupMin != null && groupMin >= 2 && groupPrice != null) {
    lines.push(
      `Skupina ${groupMin} lidí zaplatí ${groupMin} × ${formatCzk(groupPrice)} = ${formatCzk(groupMin * groupPrice)} dohromady.`
    );
  }
  return lines;
};

/** The „Do kdy" pills — fixed horizons plus a custom end date. */
const HORIZON_OPTIONS: { key: RepeatHorizon | "vlastni"; label: string }[] = [
  { key: "tento_mesic", label: "Tento měsíc" },
  { key: "ctvrt_roku", label: "Čtvrt roku" },
  { key: "pul_roku", label: "Půl roku" },
  { key: "rok", label: "Rok" },
  { key: "vlastni", label: "Vlastní konec" },
];

/** What POST /admin/courses/terms answers when `repeat` was sent along. */
type RepeatCreateResult = {
  created: number;
  skipped: number;
  skipped_dates: string[];
  failed: number;
  failed_dates: string[];
  truncated: boolean;
};

/** „Vytvořeno 12 termínů, 2 přeskočeny — už existovaly." */
const repeatResultMessage = (result: RepeatCreateResult): string => {
  const createdPart =
    result.created === 0
      ? "Žádný nový termín nevznikl"
      : result.created === 1
        ? "Vytvořen 1 termín"
        : result.created < 5
          ? `Vytvořeny ${result.created} termíny`
          : `Vytvořeno ${result.created} termínů`;
  const dates = result.skipped_dates.map(formatPragueDate).join(", ");
  const skippedPart = !result.skipped
    ? ""
    : result.skipped === 1
      ? `, 1 přeskočen — už existoval (${dates})`
      : result.skipped < 5
        ? `, ${result.skipped} přeskočeny — už existovaly (${dates})`
        : `, ${result.skipped} přeskočeno — už existovalo (${dates})`;
  return `${createdPart}${skippedPart}.`;
};

const TermEditorDrawer = ({
  term,
  trigger,
}: {
  /** Absent → create. */
  term?: AdminTerm;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TermDraft>(emptyDraft);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [horizon, setHorizon] = useState<RepeatHorizon | "vlastni">(
    "tento_mesic"
  );
  const [customEnd, setCustomEnd] = useState("");
  const queryClient = useQueryClient();

  const openWith = (next: boolean) => {
    if (next) {
      setDraft(term ? draftFromTerm(term) : emptyDraft);
      setRepeatWeekly(false);
      setHorizon("tento_mesic");
      setCustomEnd("");
    }
    setOpen(next);
  };

  /*
   * Repeat preview — the drawer runs the very same pure functions the server
   * will run again (`modules/course/recurrence.ts`), so the „Vytvoří se X
   * termínů" line and the created rows cannot drift apart. The preview is
   * display-only: the server re-derives the list from starts_at + until.
   */
  const startsAtIso = useMemo(() => {
    if (!draft.starts_at_local) return "";
    const date = new Date(draft.starts_at_local);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }, [draft.starts_at_local]);

  const repeatActive = !term && repeatWeekly;
  const untilKey = !repeatActive
    ? null
    : horizon === "vlastni"
      ? customEnd || null
      : startsAtIso
        ? horizonEndDayKey(startsAtIso, horizon)
        : null;
  const plan = useMemo(
    () =>
      repeatActive && startsAtIso && untilKey
        ? planWeeklyOccurrences(startsAtIso, untilKey)
        : null,
    [repeatActive, startsAtIso, untilKey]
  );
  const repeatReady = !repeatActive || (plan != null && plan.ok);
  const repeatPayload =
    repeatActive && untilKey && plan?.ok
      ? { frequency: "weekly" as const, until: untilKey }
      : null;

  const save = useMutation({
    mutationFn: () =>
      term
        ? sdk.client.fetch(`/admin/courses/terms/${term.id}`, {
            method: "PATCH",
            body: draftToPayload(draft),
          })
        : sdk.client.fetch(`/admin/courses/terms`, {
            method: "POST",
            body: {
              ...draftToPayload(draft),
              ...(repeatPayload ? { repeat: repeatPayload } : {}),
            },
          }),
    onSuccess: async (result: unknown) => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      const repeated =
        !term &&
        repeatPayload &&
        result &&
        typeof (result as RepeatCreateResult).created === "number"
          ? (result as RepeatCreateResult)
          : null;
      if (repeated) {
        const suffix =
          draft.status === "published"
            ? " Vypsané termíny zákazníci hned vidí na webu."
            : " Uložené jako koncepty — na webu zatím nejsou.";
        if (repeated.created > 0) {
          toast.success(repeatResultMessage(repeated) + suffix);
        } else {
          toast.warning(repeatResultMessage(repeated));
        }
        if (repeated.failed > 0) {
          toast.warning(
            `Nepodařilo se vytvořit: ${repeated.failed_dates
              .map(formatPragueDate)
              .join(", ")}. Zkuste je vypsat jednotlivě.`
          );
        }
      } else {
        toast.success(
          term
            ? "Termín byl upraven"
            : draft.status === "published"
              ? "Termín je vypsaný — zákazníci ho už vidí na webu"
              : "Termín je uložený jako koncept — na webu zatím není"
        );
      }
      setOpen(false);
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Termín se nepodařilo uložit")),
  });

  const set = (patch: Partial<TermDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  /** Everything the preview box says, or null while inputs are incomplete. */
  const repeatSummary =
    repeatActive && startsAtIso && plan?.ok
      ? (() => {
          const { year, month, day } = parseDayKey(pragueDayKey(startsAtIso));
          return {
            phrase: CZECH_WEEKLY_PHRASES[mondayIndex(year, month, day)],
            time: formatPragueTime(startsAtIso),
            occurrences: plan.occurrences,
            last: plan.occurrences[plan.occurrences.length - 1],
            truncated: plan.truncated,
          };
        })()
      : null;

  return (
    <Drawer open={open} onOpenChange={openWith}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>
            {term ? "Upravit termín" : "Nový termín kurzu"}
          </Drawer.Title>
          <Drawer.Description>
            Kde a kdy se kurz koná, kolik lidí se vejde a co zaplatí. Vypsaný
            termín se hned ukáže na webu.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="term-title">Název</Label>
              <Input
                id="term-title"
                value={draft.title}
                placeholder="Kurz točení pro dospělé"
                onChange={(event) => set({ title: event.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="term-location">Kde</Label>
                <Input
                  id="term-location"
                  value={draft.location}
                  onChange={(event) => set({ location: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="term-starts">Kdy</Label>
                <Input
                  id="term-starts"
                  type="datetime-local"
                  value={draft.starts_at_local}
                  onChange={(event) =>
                    set({ starts_at_local: event.target.value })
                  }
                />
                {/* Reminders go out ~3 dny předem and only once — a moved
                    date after that means everyone was reminded with the OLD
                    date and the system will not remind them again. */}
                {term &&
                term.status === "published" &&
                term.seats_taken > 0 &&
                draft.starts_at_local !== toLocalInput(term.starts_at) &&
                new Date(term.starts_at).getTime() - Date.now() <=
                  3 * 24 * 60 * 60 * 1000 ? (
                  <Text size="xsmall" className="text-ui-fg-error">
                    Pozor: účastníkům už mohla odejít připomínka s původním
                    datem ({formatPrague(term.starts_at)}) — novou jim systém
                    sám nepošle. Dejte jim prosím o změně vědět.
                  </Text>
                ) : null}
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="term-duration">Délka (minuty)</Label>
                <Input
                  id="term-duration"
                  type="number"
                  min={15}
                  step={15}
                  value={draft.duration_minutes}
                  placeholder="180"
                  onChange={(event) =>
                    set({ duration_minutes: event.target.value })
                  }
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Např. 180 minut = 3 hodiny.
                </Text>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="term-capacity">Kapacita (osob)</Label>
                <Input
                  id="term-capacity"
                  type="number"
                  min={1}
                  value={draft.capacity}
                  onChange={(event) => set({ capacity: event.target.value })}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Kolik lidí se do dílny vejde — po naplnění už web další
                  rezervaci nepustí.
                </Text>
              </div>
            </div>

            {!term ? (
              <section className="flex flex-col gap-y-4">
                <div>
                  <Heading level="h2">Opakování</Heading>
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    Stejný kurz každý týden — vždy ve stejný den a stejný čas
                    jako první termín. Každý vytvořený termín pak žije sám za
                    sebe: upravíte nebo zrušíte jeden, ostatních se to
                    nedotkne.
                  </Text>
                </div>
                <div className="flex items-center gap-x-3">
                  <Switch
                    id="term-repeat"
                    checked={repeatWeekly}
                    onCheckedChange={(checked) => setRepeatWeekly(checked)}
                  />
                  <Label htmlFor="term-repeat">Opakovat každý týden</Label>
                </div>
                {repeatWeekly ? (
                  <>
                    <div className="flex flex-col gap-y-2">
                      <Label>Do kdy</Label>
                      <div
                        role="group"
                        aria-label="Do kdy se má kurz opakovat"
                        className="flex flex-wrap gap-2"
                      >
                        {HORIZON_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            aria-pressed={horizon === option.key}
                            onClick={() => setHorizon(option.key)}
                            className={
                              horizon === option.key
                                ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest border-ui-border-base rounded-full border px-3 py-1 text-sm font-medium"
                                : "bg-ui-bg-subtle text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base border-ui-border-base rounded-full border px-3 py-1 text-sm"
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {horizon === "vlastni" ? (
                      <div className="flex flex-col gap-y-2">
                        <Label htmlFor="term-repeat-until">
                          Poslední den opakování
                        </Label>
                        <Input
                          id="term-repeat-until"
                          type="date"
                          value={customEnd}
                          onChange={(event) => setCustomEnd(event.target.value)}
                        />
                        <Text size="xsmall" className="text-ui-fg-muted">
                          Termín, který připadne přesně na tento den, se ještě
                          vytvoří.
                        </Text>
                      </div>
                    ) : null}
                    <div className="bg-ui-bg-subtle rounded-lg px-4 py-3">
                      <Text
                        size="xsmall"
                        weight="plus"
                        className="text-ui-fg-muted uppercase"
                      >
                        Co se vytvoří
                      </Text>
                      {!startsAtIso ? (
                        <Text size="xsmall" className="mt-1">
                          Nejdřív vyplňte datum a čas začátku — opakování se
                          odvíjí od něj.
                        </Text>
                      ) : horizon === "vlastni" && !customEnd ? (
                        <Text size="xsmall" className="mt-1">
                          Vyberte poslední den opakování.
                        </Text>
                      ) : plan && !plan.ok ? (
                        <Text size="xsmall" className="text-ui-fg-error mt-1">
                          Konec opakování je dřív než první termín — vyberte
                          pozdější datum.
                        </Text>
                      ) : repeatSummary ? (
                        <>
                          <Text size="xsmall" className="mt-1">
                            {`Vytvoří se ${termsCountLabel(repeatSummary.occurrences.length)} — ${repeatSummary.phrase} v ${repeatSummary.time}, poslední ${formatPragueDate(repeatSummary.last)}.`}
                          </Text>
                          {repeatSummary.truncated ? (
                            <Text
                              size="xsmall"
                              className="text-ui-fg-error mt-1"
                            >
                              {`Najednou jde vypsat nejvýš ${MAX_OCCURRENCES} termínů — do zvoleného konce by jich bylo víc, vytvoří se jen prvních ${MAX_OCCURRENCES}. Zbytek případně vypište novým opakováním.`}
                            </Text>
                          ) : null}
                          <div className="mt-2">
                            {(repeatSummary.occurrences.length <= 5
                              ? repeatSummary.occurrences
                              : repeatSummary.occurrences.slice(0, 3)
                            ).map((occurrence) => (
                              <Text
                                key={occurrence}
                                size="xsmall"
                                className="text-ui-fg-muted"
                              >
                                · {formatPrague(occurrence)}
                              </Text>
                            ))}
                            {repeatSummary.occurrences.length > 5 ? (
                              <>
                                <Text
                                  size="xsmall"
                                  className="text-ui-fg-muted"
                                >
                                  {`· … a dalších ${repeatSummary.occurrences.length - 4} týdnů …`}
                                </Text>
                                <Text
                                  size="xsmall"
                                  className="text-ui-fg-muted"
                                >
                                  · {formatPrague(repeatSummary.last)}
                                </Text>
                              </>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

            <section className="flex flex-col gap-y-4">
              <div>
                <Heading level="h2">Ceny</Heading>
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  Každá cena je za jednoho člověka. Cena za dva a skupinová
                  cena jsou nepovinné — bez nich platí každý cenu za jednoho.
                </Text>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="term-price-single">Cena za jednoho (Kč)</Label>
                  <Input
                    id="term-price-single"
                    type="number"
                    min={0}
                    value={draft.price_single}
                    onChange={(event) =>
                      set({ price_single: event.target.value })
                    }
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Kolik zaplatí ten, kdo přijde sám.
                  </Text>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="term-price-two">
                    Cena za dva — za osobu (Kč)
                  </Label>
                  <Input
                    id="term-price-two"
                    type="number"
                    min={0}
                    value={draft.price_two}
                    placeholder="nepovinné"
                    onChange={(event) => set({ price_two: event.target.value })}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Když přijdou dva spolu, tolik zaplatí každý z nich.
                  </Text>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="term-group-min">Skupina od (osob)</Label>
                  <Input
                    id="term-group-min"
                    type="number"
                    min={2}
                    value={draft.group_min}
                    placeholder="nepovinné"
                    onChange={(event) => set({ group_min: event.target.value })}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Od kolika lidí platí skupinová cena.
                  </Text>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="term-group-price">
                    Skupinová cena — za osobu (Kč)
                  </Label>
                  <Input
                    id="term-group-price"
                    type="number"
                    min={0}
                    value={draft.price_group_per_person}
                    placeholder="nepovinné"
                    onChange={(event) =>
                      set({ price_group_per_person: event.target.value })
                    }
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Tolik zaplatí každý člověk ve skupině.
                  </Text>
                </div>
              </div>
              {pricingExampleLines(draft).length > 0 && (
                <div className="bg-ui-bg-subtle rounded-lg px-4 py-3">
                  <Text
                    size="xsmall"
                    weight="plus"
                    className="text-ui-fg-muted uppercase"
                  >
                    Pro kontrolu
                  </Text>
                  {pricingExampleLines(draft).map((line) => (
                    <Text key={line} size="xsmall" className="mt-1">
                      {line}
                    </Text>
                  ))}
                </div>
              )}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-y-2">
                <Label>Stav</Label>
                <Select
                  value={draft.status}
                  onValueChange={(status) =>
                    set({ status: status as TermDraft["status"] })
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="draft">
                      Koncept — zákazníci ho nevidí
                    </Select.Item>
                    <Select.Item value="published">
                      Vypsaný — lze rezervovat
                    </Select.Item>
                    {term ? (
                      <Select.Item value="finished">
                        Proběhlý — už se konal
                      </Select.Item>
                    ) : null}
                  </Select.Content>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="term-note">Poznámka k termínu</Label>
              <Textarea
                id="term-note"
                rows={3}
                value={draft.note}
                placeholder="Vezměte si prosím ručník a přezůvky."
                onChange={(event) => set({ note: event.target.value })}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Pošle se i účastníkům v připomínce tři dny před kurzem —
                ideální místo pro „co s sebou". Nepište sem nic, co nemají
                číst zákazníci.
              </Text>
            </div>

            {draftProblems(draft).length > 0 && (
              <div className="flex flex-col gap-y-1">
                {draftProblems(draft).map((problem) => (
                  <Text
                    key={problem}
                    size="xsmall"
                    className="text-ui-fg-subtle"
                  >
                    · {problem}
                  </Text>
                ))}
              </div>
            )}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            variant="primary"
            isLoading={save.isPending}
            disabled={!draftIsValid(draft) || !repeatReady}
            onClick={() => save.mutate()}
          >
            {term
              ? "Uložit změny"
              : repeatSummary && repeatSummary.occurrences.length > 1
                ? `Vytvořit ${termsCountLabel(repeatSummary.occurrences.length)}`
                : "Vytvořit termín"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */
/* Manual reservation                                                  */
/* ------------------------------------------------------------------ */

const ManualReservationDrawer = ({ term }: { term: AdminTerm }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/courses/terms/${term.id}/reservations`, {
        method: "POST",
        body: {
          name: name.trim(),
          party_size: Number(partySize),
          email: email.trim() || null,
          phone: phone.trim() || null,
          note: note.trim() || null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      toast.success("Rezervace byla zapsána");
      setOpen(false);
      setName("");
      setPartySize("1");
      setEmail("");
      setPhone("");
      setNote("");
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Rezervaci se nepodařilo zapsat")),
  });

  const valid =
    name.trim().length >= 2 &&
    Number.isInteger(Number(partySize)) &&
    Number(partySize) >= 1;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          Zapsat rezervaci
        </Button>
      </Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Zapsat rezervaci ručně</Drawer.Title>
          <Drawer.Description>
            Pro telefonické domluvy — stačí jméno a počet lidí. Zaplatí na
            místě.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-5">
            <div className="bg-ui-bg-subtle rounded-lg px-4 py-3">
              <Text size="small" weight="plus">
                {term.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                {formatPrague(term.starts_at)} · volných {term.seats_left} z{" "}
                {term.capacity}
              </Text>
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="manual-name">Jméno</Label>
              <Input
                id="manual-name"
                value={name}
                placeholder="paní Nováková"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="manual-count">Počet osob</Label>
              <Input
                id="manual-count"
                type="number"
                min={1}
                max={term.seats_left || undefined}
                value={partySize}
                onChange={(event) => setPartySize(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="manual-phone">Telefon (nepovinné)</Label>
                <Input
                  id="manual-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="manual-email">E-mail (nepovinné)</Label>
                <Input
                  id="manual-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="manual-note">Poznámka</Label>
              <Textarea
                id="manual-note"
                rows={3}
                value={note}
                placeholder="zavolala v úterý, přijdou 3"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            variant="primary"
            isLoading={create.isPending}
            disabled={!valid}
            onClick={() => create.mutate()}
          >
            Zapsat
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */
/* Cancel prompts                                                      */
/* ------------------------------------------------------------------ */

const CancelTermPrompt = ({ term }: { term: AdminTerm }) => {
  const queryClient = useQueryClient();
  const activeWithEmail = term.reservations.filter(
    (reservation) => reservation.status !== "cancelled" && reservation.email
  ).length;
  const activeCount = term.reservations.filter(
    (reservation) => reservation.status !== "cancelled"
  ).length;
  const paidCount = term.reservations.filter(
    (reservation) =>
      reservation.status !== "cancelled" &&
      reservation.payment_method === "online" &&
      reservation.payment_status === "paid"
  ).length;

  const cancel = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        emails_sent: number;
        paid_online: { name: string; refunded: boolean; refund_failed: boolean }[];
        reservations_without_email: string[];
        refunds: {
          refunded_count: number;
          manual_count: number;
          manual_names: string[];
        };
      }>(`/admin/courses/terms/${term.id}/cancel`, { method: "POST" }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      const refunds = result.refunds ?? {
        refunded_count: 0,
        manual_count: 0,
        manual_names: [],
      };
      toast.success(
        `Termín zrušen. Odesláno ${result.emails_sent} e-mailů.` +
          (refunds.refunded_count
            ? ` ${refunds.refunded_count}× vráceny peníze automaticky na kartu.`
            : "")
      );
      if (refunds.manual_count) {
        toast.warning(
          `Automatické vrácení se nepovedlo — vraťte ručně: ${refunds.manual_names.join(", ")}`
        );
      }
      if (result.reservations_without_email.length) {
        toast.warning(
          `Bez e-mailu (obvolejte): ${result.reservations_without_email.join(", ")}`
        );
      }
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Termín se nepodařilo zrušit")),
  });

  return (
    <Prompt>
      <Prompt.Trigger asChild>
        <Button variant="danger" size="small">
          Zrušit termín
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Zrušit celý termín?</Prompt.Title>
          <Prompt.Description>
            {activeCount
              ? `Termín má ${activeCount} ${activeCount === 1 ? "rezervaci" : activeCount < 5 ? "rezervace" : "rezervací"}. ` +
                `Všem s e-mailem (${activeWithEmail}) odejde zpráva o zrušení.` +
                (paidCount
                  ? ` ${paidCount}× je zaplaceno kartou — peníze se pokusíme vrátit automaticky; pokud se to u někoho nepovede, hned se to dozvíte a vrátíte je ručně.`
                  : "")
              : "Termín nemá žádné rezervace. Jen zmizí z nabídky."}
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Ponechat</Prompt.Cancel>
          <Prompt.Action
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            Zrušit termín
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

const CancelReservationPrompt = ({
  reservation,
}: {
  reservation: AdminReservation;
}) => {
  const queryClient = useQueryClient();
  const paidOnline =
    reservation.payment_method === "online" &&
    reservation.payment_status === "paid";

  const cancel = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        customer_emailed: boolean;
        needs_manual_refund: boolean;
        refund: {
          attempted: boolean;
          refunded: boolean;
          amount: number | null;
        } | null;
      }>(`/admin/courses/reservations/${reservation.id}/cancel`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      const emailed = result.customer_emailed
        ? " Zákazník dostal e-mail o zrušení."
        : "";
      if (result.refund?.refunded) {
        toast.success(
          `Rezervace zrušena. ${
            result.refund.amount != null
              ? `${formatCzk(result.refund.amount)} se vrací`
              : "Peníze se vrací"
          } zákazníkovi zpět na kartu.${emailed}`
        );
      } else if (result.needs_manual_refund) {
        toast.warning(
          `Rezervace zrušena, ale automatické vrácení peněz se nepovedlo — částku prosím vraťte ručně (např. převodem).${emailed}`
        );
      } else {
        toast.success(`Rezervace zrušena, místa se uvolnila.${emailed}`);
      }
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Rezervaci se nepodařilo zrušit")),
  });

  return (
    <Prompt>
      <Prompt.Trigger asChild>
        <Button variant="transparent" size="small" className="text-ui-fg-error">
          Zrušit
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Zrušit rezervaci?</Prompt.Title>
          <Prompt.Description>
            {`${reservation.name} — ${people(reservation.party_size)}. Místa se uvolní dalším zájemcům.`}
            {paidOnline
              ? " Rezervace je zaplacená kartou — peníze se pokusíme vrátit automaticky zpět na kartu. Pokud se to nepovede, hned se to dozvíte a částku vrátíte ručně."
              : ""}
            {reservation.email
              ? " Zákazníkovi pošleme e-mail o zrušení."
              : ""}
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Ponechat</Prompt.Cancel>
          <Prompt.Action
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            Zrušit rezervaci
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/* ------------------------------------------------------------------ */
/* Term card                                                           */
/* ------------------------------------------------------------------ */

const seatsLeftLabel = (left: number): string => {
  if (left <= 0) return "plně obsazeno";
  if (left === 1) return "zbývá 1 volné místo";
  if (left < 5) return `zbývají ${left} volná místa`;
  return `zbývá ${left} volných míst`;
};

const OccupancyBar = ({ term }: { term: AdminTerm }) => {
  const ratio = term.capacity ? Math.min(1, term.seats_taken / term.capacity) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-x-3">
        <Text size="xsmall" className="text-ui-fg-muted uppercase">
          Obsazenost
        </Text>
        <Text size="small" weight="plus">
          {term.seats_taken}/{term.capacity}{" "}
          <span
            className={
              term.seats_left <= 0
                ? "text-ui-tag-red-text font-normal"
                : "text-ui-fg-muted font-normal"
            }
          >
            · {seatsLeftLabel(term.seats_left)}
          </span>
        </Text>
      </div>
      <div className="bg-ui-bg-subtle mt-1 h-2 w-full overflow-hidden rounded-full">
        <div
          className={
            ratio >= 1
              ? "bg-ui-tag-red-icon h-full rounded-full"
              : ratio >= 0.75
                ? "bg-ui-tag-orange-icon h-full rounded-full"
                : "bg-ui-tag-green-icon h-full rounded-full"
          }
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
};

const priceSummary = (term: AdminTerm): string => {
  const parts = [`${formatCzk(term.price_single)}/os.`];
  if (term.price_two != null) {
    parts.push(`za dva ${formatCzk(term.price_two)}/os.`);
  }
  if (term.group_min != null && term.price_group_per_person != null) {
    parts.push(
      `od ${term.group_min} lidí ${formatCzk(term.price_group_per_person)}/os.`
    );
  }
  return parts.join(" · ");
};

const TermCard = ({ term }: { term: AdminTerm }) => {
  const [showReservations, setShowReservations] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const expert = useExpertMode();
  const waitlistEntries = term.waitlist ?? [];
  const waitlistWaiting =
    term.waitlist_waiting ??
    waitlistEntries.filter((entry) => !entry.notified_at).length;
  const status = TERM_STATUS[term.status];
  const activeReservations = term.reservations.filter(
    (reservation) => reservation.status !== "cancelled"
  );
  const cancelledReservations = term.reservations.filter(
    (reservation) => reservation.status === "cancelled"
  );
  const editable = term.status !== "cancelled";

  return (
    <article className="bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-y-4 rounded-xl p-5">
      <div className="flex items-start justify-between gap-x-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h2" className="truncate">
              {term.title}
            </Heading>
            <Badge color={status.color}>{status.label}</Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {formatPrague(term.starts_at)}
            {term.duration_minutes
              ? ` · ${formatDuration(term.duration_minutes)}`
              : ""}{" "}
            · {term.location}
          </Text>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            {priceSummary(term)}
          </Text>
          {term.note ? (
            <Text size="xsmall" className="text-ui-fg-muted mt-1">
              {term.note}
            </Text>
          ) : null}
          {expert && <CopyId value={term.id} />}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-y-2">
          {editable ? (
            <TermEditorDrawer
              term={term}
              trigger={
                <Button variant="secondary" size="small">
                  Upravit
                </Button>
              }
            />
          ) : null}
          {editable ? <CancelTermPrompt term={term} /> : null}
        </div>
      </div>

      <OccupancyBar term={term} />

      <div className="border-ui-border-base flex items-center justify-between border-t pt-4">
        <button
          type="button"
          className="text-ui-fg-interactive text-sm outline-none hover:underline focus-visible:underline"
          onClick={() => setShowReservations((value) => !value)}
        >
          {showReservations
            ? "Skrýt rezervace"
            : `Rezervace (${activeReservations.length}${
                cancelledReservations.length
                  ? ` + ${cancelledReservations.length} zruš.`
                  : ""
              })`}
        </button>
        {editable ? <ManualReservationDrawer term={term} /> : null}
      </div>

      {showReservations ? (
        term.reservations.length ? (
          <div className="shadow-borders-base divide-y overflow-hidden rounded-lg">
            {term.reservations.map((reservation) => (
              <div
                key={reservation.id}
                className={`grid gap-2 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center ${
                  reservation.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <Text size="small" weight="plus" className="truncate">
                    {reservation.name}{" "}
                    <span className="text-ui-fg-muted font-normal">
                      · {people(reservation.party_size)}
                    </span>
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted truncate">
                    {[reservation.phone, reservation.email]
                      .filter(Boolean)
                      .join(" · ") ||
                      (reservation.source === "manual"
                        ? "bez kontaktu (ruční zápis)"
                        : "bez kontaktu")}
                  </Text>
                  {reservation.note ? (
                    <Text size="xsmall" className="text-ui-fg-muted italic">
                      {reservation.note}
                    </Text>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {paymentBadge(reservation)}
                  <Text size="small">
                    {formatCzk(reservation.total_price)}{" "}
                    <span className="text-ui-fg-muted">
                      ({TIER_LABEL[reservation.pricing_tier]})
                    </span>
                  </Text>
                </div>
                <div className="flex items-center justify-end">
                  {reservation.status !== "cancelled" ? (
                    <CancelReservationPrompt reservation={reservation} />
                  ) : (
                    <div className="text-right">
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {cancelReasonLabel(reservation)}
                      </Text>
                      {cancelledMoneyLabel(reservation) ? (
                        <Text
                          size="xsmall"
                          className={
                            reservation.refunded_at
                              ? "text-ui-fg-muted"
                              : "text-ui-fg-error"
                          }
                        >
                          {cancelledMoneyLabel(reservation)}
                        </Text>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            Zatím žádné rezervace. Zákazníci se hlásí na webu, telefonické
            domluvy zapište tlačítkem „Zapsat rezervaci".
          </Text>
        )
      ) : null}

      {/* A cancelled or finished term ignores its waitlist by design —
          showing „čekají" there would promise a notification that never
          comes, so the block only renders while the term can still free
          seats. */}
      {waitlistEntries.length &&
      (term.status === "published" || term.status === "draft") ? (
        <div className="border-ui-border-base border-t pt-4">
          <button
            type="button"
            className="text-ui-fg-interactive text-sm outline-none hover:underline focus-visible:underline"
            onClick={() => setShowWaitlist((value) => !value)}
          >
            {showWaitlist
              ? "Skrýt čekající"
              : `Čekají na uvolnění místa: ${waitlistWaiting}${
                  waitlistEntries.length > waitlistWaiting
                    ? ` (+ ${waitlistEntries.length - waitlistWaiting} už dostali zprávu)`
                    : ""
                }`}
          </button>
          {showWaitlist ? (
            <div className="mt-3 flex flex-col gap-y-2">
              <Text size="xsmall" className="text-ui-fg-muted">
                Jakmile se uvolní dost míst, dostanou automaticky e-mail —
                nejdřív ti, kdo se zapsali první. Místa se jim nedrží, platí
                kdo dřív dokončí rezervaci.
              </Text>
              {waitlistEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3"
                >
                  <Text size="small">
                    {entry.name}{" "}
                    <span className="text-ui-fg-muted">
                      · {people(entry.party_size)}
                      {entry.email ? ` · ${entry.email}` : ""}
                    </span>
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {entry.notified_at
                      ? "dostali zprávu o uvolnění"
                      : "čekají"}
                  </Text>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <RawData data={term} />
    </article>
  );
};

/* ------------------------------------------------------------------ */
/* Calendar view                                                       */
/* ------------------------------------------------------------------ */

/**
 * „Kalendář / Seznam" — the choice persists per browser, same pattern as the
 * shared view switcher. Seznam is the default: it is what she is used to.
 */
type TermsView = "seznam" | "kalendar";

const TERMS_VIEW_KEY = "kz-kurzy-terms-view";

const readTermsView = (): TermsView => {
  try {
    return localStorage.getItem(TERMS_VIEW_KEY) === "kalendar"
      ? "kalendar"
      : "seznam";
  } catch {
    return "seznam";
  }
};

const TermsViewSwitch = ({
  value,
  onChange,
}: {
  value: TermsView;
  onChange: (next: TermsView) => void;
}) => (
  <div
    role="group"
    aria-label="Zobrazení termínů"
    className="border-ui-border-base bg-ui-bg-subtle flex shrink-0 items-center gap-0.5 rounded-lg border p-1"
  >
    {(
      [
        { key: "seznam", label: "Seznam" },
        { key: "kalendar", label: "Kalendář" },
      ] as const
    ).map((option) => (
      <button
        key={option.key}
        type="button"
        aria-pressed={value === option.key}
        onClick={() => onChange(option.key)}
        className={
          value === option.key
            ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest rounded-md px-2.5 py-1 text-sm font-medium"
            : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base rounded-md px-2.5 py-1 text-sm"
        }
      >
        {option.label}
      </button>
    ))}
  </div>
);

/**
 * One term as a compact chip in a day cell — „17:00 · 3/8" plus the state in
 * a word AND a color (volno / skoro plno / plno), because color alone is not
 * information. Drafts are visually muted and say „koncept". Clicking opens
 * the very same edit drawer the list cards use.
 */
/** Most chips one day cell shows before collapsing into „+ X dalších". */
const MAX_DAY_CHIPS = 4;

const CalendarTermChip = ({
  term,
  dayKey,
}: {
  term: AdminTerm;
  dayKey: string;
}) => {
  const time = formatPragueTime(term.starts_at);
  const isDraft = term.status === "draft";
  const ratio = term.capacity
    ? Math.min(1, term.seats_taken / term.capacity)
    : 0;
  const stateWord =
    term.seats_left <= 0 ? "plno" : ratio >= 0.75 ? "skoro plno" : "volno";
  const chipClass = isDraft
    ? "border-ui-border-strong bg-ui-bg-subtle text-ui-fg-muted border border-dashed"
    : term.seats_left <= 0
      ? "border-ui-tag-red-border bg-ui-tag-red-bg text-ui-tag-red-text border"
      : ratio >= 0.75
        ? "border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text border"
        : "border-ui-tag-green-border bg-ui-tag-green-bg text-ui-tag-green-text border";
  const ariaLabel = [
    term.title,
    `${dayLabel(dayKey)} v ${time}`,
    `obsazeno ${term.seats_taken} z ${term.capacity}`,
    isDraft
      ? "koncept — zákazníci ho nevidí"
      : term.status === "finished"
        ? "už proběhl"
        : stateWord,
    "otevře úpravu termínu",
  ].join(", ");

  return (
    <TermEditorDrawer
      term={term}
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          className={`${chipClass} w-full rounded-md px-1.5 py-1 text-left text-xs leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ui-border-interactive`}
        >
          <span className="font-medium">{time}</span>
          {` · ${term.seats_taken}/${term.capacity}`}
          <span className="block truncate">
            {isDraft ? "koncept" : stateWord}
            {` · ${term.title}`}
          </span>
        </button>
      }
    />
  );
};

/**
 * Czech Monday-first month grid of terms. Cancelled terms are filtered out
 * before this renders — they live in the „Proběhlé a zrušené" tab. Month
 * navigation is unbounded both ways: past months simply show past terms.
 */
const TermsCalendar = ({ terms }: { terms: AdminTerm[] }) => {
  const [month, setMonth] = useState<CalendarMonth>(() =>
    pragueMonthOf(new Date().toISOString())
  );
  const byDay = useMemo(() => groupByPragueDay(terms), [terms]);
  const weeks = buildMonthGrid(month.year, month.month);
  const todayKey = pragueDayKey(new Date().toISOString());
  const monthHasTerms = weeks
    .flat()
    .some((cell) => cell && byDay.has(cell.key));

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-x-2">
          <Button
            variant="secondary"
            size="small"
            aria-label="Předchozí měsíc"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            ‹
          </Button>
          <Heading level="h2" className="min-w-32 text-center" aria-live="polite">
            {monthTitle(month)}
          </Heading>
          <Button
            variant="secondary"
            size="small"
            aria-label="Další měsíc"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            ›
          </Button>
        </div>
        <Button
          variant="transparent"
          size="small"
          onClick={() => setMonth(pragueMonthOf(new Date().toISOString()))}
        >
          Dnes
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {CZECH_WEEKDAYS.map((weekday) => (
          <Text
            key={weekday.short}
            size="xsmall"
            weight="plus"
            className="text-ui-fg-muted px-1 text-center uppercase"
            aria-label={weekday.long}
          >
            {weekday.short}
          </Text>
        ))}
        {weeks.flat().map((cell, index) =>
          cell ? (
            <div
              key={cell.key}
              className={`min-h-24 rounded-lg border p-1.5 ${
                cell.key === todayKey
                  ? "border-ui-border-interactive"
                  : "border-ui-border-base"
              }`}
            >
              <Text
                size="xsmall"
                className={
                  cell.key === todayKey
                    ? "text-ui-fg-interactive font-medium"
                    : "text-ui-fg-muted"
                }
              >
                {cell.day}
                {cell.key === todayKey ? " · dnes" : ""}
              </Text>
              {byDay.has(cell.key) ? (
                <div className="mt-1 flex flex-col gap-1">
                  {(() => {
                    const dayTerms = (byDay.get(cell.key) ?? [])
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.starts_at).getTime() -
                          new Date(b.starts_at).getTime()
                      );
                    // An unusually crowded day must not stretch the whole
                    // week's row: show the first chips and say how many more
                    // there are — the rest is one click away in Seznam.
                    const shown =
                      dayTerms.length > MAX_DAY_CHIPS
                        ? dayTerms.slice(0, MAX_DAY_CHIPS - 1)
                        : dayTerms;
                    return (
                      <>
                        {shown.map((term) => (
                          <CalendarTermChip
                            key={term.id}
                            term={term}
                            dayKey={cell.key}
                          />
                        ))}
                        {shown.length < dayTerms.length ? (
                          <Text
                            size="xsmall"
                            className="text-ui-fg-muted px-1.5"
                          >
                            {`+ ${dayTerms.length - shown.length} ${
                              dayTerms.length - shown.length < 5
                                ? "další"
                                : "dalších"
                            } — viz Seznam`}
                          </Text>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : (
            <div
              key={`pad-${index}`}
              className="min-h-24 rounded-lg"
              aria-hidden="true"
            />
          )
        )}
      </div>

      {!monthHasTerms ? (
        <Text size="small" className="text-ui-fg-muted">
          V tomto měsíci není žádný termín.
        </Text>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const KurzySpravaInner = () => {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [termsView, setTermsViewState] = useState<TermsView>(readTermsView);
  const setTermsView = (next: TermsView) => {
    setTermsViewState(next);
    try {
      localStorage.setItem(TERMS_VIEW_KEY, next);
    } catch {
      // Soukromé okno apod. — volba jen nepřežije obnovení stránky.
    }
  };
  const termsQuery = useQuery<{ terms: AdminTerm[] }>({
    queryKey: ["course-terms"],
    queryFn: () => sdk.client.fetch("/admin/courses/terms"),
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const terms = termsQuery.data?.terms ?? [];
    const upcomingTerms = terms
      .filter(
        (term) =>
          new Date(term.starts_at).getTime() > now &&
          term.status !== "cancelled" &&
          term.status !== "finished"
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
    const pastTerms = terms
      .filter((term) => !upcomingTerms.includes(term))
      .sort(
        (a, b) =>
          new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
      );
    return { upcoming: upcomingTerms, past: pastTerms };
  }, [termsQuery.data]);

  const visible = tab === "upcoming" ? upcoming : past;

  /**
   * The calendar shows every non-cancelled term — not just the upcoming
   * ones — so paging back through months shows what already ran. Cancelled
   * terms stay out: they live in the „Proběhlé a zrušené" tab.
   */
  const calendarTerms = useMemo(
    () =>
      (termsQuery.data?.terms ?? []).filter(
        (term) => term.status !== "cancelled"
      ),
    [termsQuery.data]
  );

  const showCalendar = tab === "upcoming" && termsView === "kalendar";

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Heading>Kurzy</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
            Termíny kurzů a rezervace míst — kdo přijde, kolik zaplatí a kolik
            míst ještě zbývá. Vypsaný termín se hned ukáže na webu v sekci
            Kurzy; koho domluvíte po telefonu, zapište tlačítkem „Zapsat
            rezervaci" u termínu.
          </Text>
        </div>
        <div className="flex items-center gap-4">
          <ExpertToggle />
          <TermEditorDrawer
            trigger={<Button variant="primary">Nový termín</Button>}
          />
        </div>
      </header>

      <SubTabs
        tabs={[
          { key: "upcoming", label: "Nadcházející", count: upcoming.length },
          { key: "past", label: "Proběhlé a zrušené", count: past.length },
        ]}
        active={tab}
        onSelect={(key) => setTab(key as "upcoming" | "past")}
      />

      <div className="px-6 py-6">
        {tab === "upcoming" && !termsQuery.isError && (
          <div className="mb-4 flex justify-end">
            <TermsViewSwitch value={termsView} onChange={setTermsView} />
          </div>
        )}

        {termsQuery.isLoading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-52 rounded-xl" />
            ))}
          </div>
        )}

        {termsQuery.isError && (
          <div className="border-ui-border-error flex min-h-40 flex-col items-center justify-center rounded-lg border px-6 text-center">
            <Heading level="h2">Termíny se nepodařilo načíst</Heading>
            <Text size="small" className="text-ui-fg-error mt-1">
              Obnovte stránku a zkuste to znovu.
            </Text>
          </div>
        )}

        {!termsQuery.isLoading && !termsQuery.isError && showCalendar && (
          <TermsCalendar terms={calendarTerms} />
        )}

        {!termsQuery.isLoading &&
          !termsQuery.isError &&
          !showCalendar &&
          !visible.length && (
          <EmptyState
            title={
              tab === "upcoming"
                ? "Žádné nadcházející termíny"
                : "Zatím nic neproběhlo"
            }
            description={
              tab === "upcoming"
                ? "Vypište termín a zákazníci si ho hned mohou rezervovat na webu v sekci Kurzy."
                : "Sem se přesunou termíny, které už proběhly nebo byly zrušeny."
            }
            action={
              tab === "upcoming" ? (
                <TermEditorDrawer
                  trigger={<Button variant="primary">Nový termín</Button>}
                />
              ) : undefined
            }
          />
        )}

        {!termsQuery.isLoading &&
          !termsQuery.isError &&
          !showCalendar &&
          visible.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((term) => (
              <TermCard key={term.id} term={term} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
};

const KurzySpravaPage = () => (
  <QueryClientProvider client={queryClient}>
    <KurzySpravaInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Kurzy",
  icon: AcademicCap,
  rank: 70,
});

export default KurzySpravaPage;
