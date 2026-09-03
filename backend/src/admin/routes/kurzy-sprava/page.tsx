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
  parseTimeOfDay,
  utcFromPragueWallClock,
} from "../../../modules/course/recurrence";
import {
  type CalendarMonth,
  CZECH_WEEKDAYS,
  addMonths,
  buildMonthGrid,
  dayLabel,
  groupByPragueDay,
  monthTitle,
  parseDayKey,
  pragueDayKey,
  pragueMonthOf,
} from "../../lib/course-calendar";
import { CourseDayPicker } from "../../components/course-day-picker";
import { CourseTermWizard } from "../../components/course-term-wizard";
import {
  CourseNoteDrawer,
  CoursePricingDrawer,
} from "../../components/course-bulk-dialogs";

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

/** Just the Prague wall-clock time — „17:00". */
const formatPragueTime = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatDuration = (minutes: number | null): string => {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const people = (count: number): string =>
  `${count} ${count === 1 ? "osoba" : count < 5 ? "osoby" : "osob"}`;

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

/**
 * Editing one term: what it is called, where and when it happens, how many fit.
 *
 * Prices and the participant note deliberately live elsewhere now
 * (`components/course-bulk-dialogs.tsx`). Both are things the owner changes
 * for a season rather than for a session, and having them here meant every
 * seasonal price change was a tour of fourteen identical forms. Creating
 * terms is `CourseTermWizard`; this drawer only ever edits an existing one.
 */
const TermEditorDrawer = ({
  term,
  trigger,
}: {
  term: AdminTerm;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(term.title);
  const [location, setLocation] = useState(term.location);
  const [day, setDay] = useState(() => pragueDayKey(term.starts_at));
  const [time, setTime] = useState(() => formatPragueTime(term.starts_at));
  const [duration, setDuration] = useState(
    term.duration_minutes ? String(term.duration_minutes) : ""
  );
  const [capacity, setCapacity] = useState(String(term.capacity));
  const [status, setStatus] = useState<"draft" | "published" | "finished">(
    term.status === "cancelled" ? "draft" : term.status
  );
  const queryClient = useQueryClient();

  const openWith = (next: boolean) => {
    if (next) {
      setTitle(term.title);
      setLocation(term.location);
      setDay(pragueDayKey(term.starts_at));
      setTime(formatPragueTime(term.starts_at));
      setDuration(term.duration_minutes ? String(term.duration_minutes) : "");
      setCapacity(String(term.capacity));
      setStatus(term.status === "cancelled" ? "draft" : term.status);
    }
    setOpen(next);
  };

  const clock = parseTimeOfDay(time);
  const startsAtIso =
    clock && day
      ? utcFromPragueWallClock({
          ...parseDayKey(day),
          hour: clock.hour,
          minute: clock.minute,
          second: 0,
        }).toISOString()
      : null;

  const capacityNumber = Number(capacity);
  const problems: string[] = [];
  if (!title.trim()) problems.push("Chybí název kurzu.");
  if (!location.trim()) problems.push("Chybí místo konání.");
  if (!day) problems.push("Vyberte v kalendáři den.");
  if (!clock) problems.push("Čas začátku zadejte ve tvaru 17:00.");
  if (!Number.isInteger(capacityNumber) || capacityNumber < 1)
    problems.push("Kapacita musí být aspoň 1 osoba.");
  if (
    Number.isInteger(capacityNumber) &&
    capacityNumber < term.seats_taken
  )
    problems.push(
      `Kapacitu nejde snížit pod už rezervovaná místa (${term.seats_taken}).`
    );

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/courses/terms/${term.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(),
          location: location.trim(),
          ...(startsAtIso ? { starts_at: startsAtIso } : {}),
          duration_minutes: duration.trim() ? Number(duration) : null,
          capacity: capacityNumber,
          status,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      toast.success("Termín byl upraven");
      setOpen(false);
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Termín se nepodařilo uložit")),
  });

  return (
    <Drawer open={open} onOpenChange={openWith}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Upravit termín</Drawer.Title>
          <Drawer.Description>
            Kde a kdy se kurz koná a kolik lidí se vejde. Ceny a poznámku
            najdete pod vlastními tlačítky na kartě termínu.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-title">Název</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-location">Kde</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-3">
              <Label>Kdy</Label>
              <CourseDayPicker
                selected={day ? [day] : []}
                // One term stands on one day: a second click moves it there
                // rather than adding a date this drawer could not save.
                onChange={(next) => setDay(next[next.length - 1] ?? "")}
                emptyHint="Klikněte na den, kdy se termín koná."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="edit-time">Čas začátku</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="edit-duration">Délka (minuty)</Label>
                <Input
                  id="edit-duration"
                  inputMode="numeric"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="edit-capacity">Kapacita (osob)</Label>
                <Input
                  id="edit-capacity"
                  inputMode="numeric"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-status">Stav</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as "draft" | "published" | "finished")
                }
              >
                <Select.Trigger id="edit-status">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="published">
                    Vypsaný — lze rezervovat
                  </Select.Item>
                  <Select.Item value="draft">Koncept — na webu není</Select.Item>
                  <Select.Item value="finished">Proběhlý — už se konal</Select.Item>
                </Select.Content>
              </Select>
            </div>

            {problems.length ? (
              <div className="flex flex-col gap-y-1">
                {problems.map((problem) => (
                  <Text key={problem} size="small" className="text-ui-fg-muted">
                    · {problem}
                  </Text>
                ))}
              </div>
            ) : null}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            variant="primary"
            isLoading={save.isPending}
            disabled={problems.length > 0}
            onClick={() => save.mutate()}
          >
            Uložit změny
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

const TermCard = ({
  term,
  allTerms,
}: {
  term: AdminTerm;
  /** Every term — the Ceny and Poznámky dialogs let the edit reach beyond this one. */
  allTerms: AdminTerm[];
}) => {
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
            <div className="flex items-center gap-x-2">
              <TermEditorDrawer
                term={term}
                trigger={
                  <Button variant="secondary" size="small">
                    Upravit
                  </Button>
                }
              />
              {/* Prices got their own door: they are a seasonal decision, and
                  the dialog can carry one change across every term at once. */}
              <CoursePricingDrawer
                term={term}
                terms={allTerms}
                trigger={
                  <Button variant="secondary" size="small">
                    Ceny
                  </Button>
                }
              />
            </div>
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
        <div className="flex flex-col gap-y-3">
          {/* The note lives here rather than in the term form on purpose: it
              is what these people will read in their reminder e-mail, so the
              place to write it is the screen where you can see who they are. */}
          <div className="flex items-center justify-between gap-2">
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              {term.note ? `Poznámka: ${term.note}` : "Bez poznámky"}
            </Text>
            {editable ? (
              <CourseNoteDrawer
                term={term}
                terms={allTerms}
                trigger={
                  <Button variant="secondary" size="small">
                    Poznámky
                  </Button>
                }
              />
            ) : null}
          </div>
          {term.reservations.length ? (
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
          )}
        </div>
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

  /** Day key → how many terms already stand there, for the picker's dots. */
  const termCounts = useMemo(
    () =>
      new Map(
        Array.from(groupByPragueDay(calendarTerms).entries()).map(
          ([key, list]) => [key, list.length]
        )
      ),
    [calendarTerms]
  );

  /** Every non-cancelled term — the scope pickers reason over all of them. */
  const allTerms = termsQuery.data?.terms ?? [];

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
          <CourseTermWizard
            termCounts={termCounts}
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
                <CourseTermWizard
                  termCounts={termCounts}
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
              <TermCard key={term.id} term={term} allTerms={allTerms} />
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
