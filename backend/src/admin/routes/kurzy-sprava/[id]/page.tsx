import { ArrowUturnLeft } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Skeleton,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { CourseDayPicker } from "../../../components/course-day-picker";
import { EmptyState } from "../../../components/empty-state";
import {
  InlineNumber,
  InlineText,
  InlineTextarea,
} from "../../../components/inline-field";
import { ceskaChyba } from "../../../lib/ceska-chyba";
import {
  PRAGUE_TZ,
  dayLabel,
  pragueDayKey,
  parseDayKey,
} from "../../../lib/course-calendar";
import { adminQueryClient } from "../../../lib/query-client";
import { sdk } from "../../../lib/sdk";
import { formatCzk } from "../../../lib/workbench";
import { toastWithUndo } from "../../../lib/undo";
import {
  attendanceRows,
  attendanceSummary,
  formatKc,
  messageRecipients,
  persons,
  type AttendanceRow,
} from "../../../../lib/course-attendance";

/**
 * Jeden termín kurzu — vlastní stránka, ne vysouvací panel.
 *
 * ## Proč stránka
 *
 * Termín není dialog: má datum, místo, kapacitu, čtyři ceny, poznámku, seznam
 * účastníků s penězi u každého z nich a čekací listinu. To se do bočního
 * panelu nevejde a v seznamu kurzů to dělalo karty se sedmi tlačítky.
 * Adresa navíc jde poslat a obnovit — panel se po F5 zavře.
 *
 * ## Ukládání
 *
 * Údaje termínu se ukládají při opuštění pole (pravidlo adminu: uvnitř jedné
 * věci se ukládá samo). Co sáhne na peníze nebo na zákazníka — zaplaceno,
 * faktura, zrušení — má vlastní tlačítko a u nevratných věcí se ptá.
 */

type Reservation = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  pricing_tier: "single" | "pair" | "group";
  total_price: number;
  /** Zaplaceno celkem (prvotní platba + doplatky − vrácené). */
  paid_amount?: number;
  /** Zbývá doplatit (doplatek po úpravě počtu osob / platba na místě). */
  amount_due?: number;
  payment_method: "online" | "on_site";
  payment_status: "pending" | "paid" | "on_site";
  /** Schválená žádost o místo — zákazník si platbu ještě nevybral. */
  payment_choice_pending?: boolean;
  paid_at: string | null;
  status: "active" | "cancelled";
  cancel_reason: string | null;
  refunded_at: string | null;
  source: "web" | "manual";
  note: string | null;
  idoklad_invoice_number: string | null;
  idoklad_pdf_url: string | null;
  created_at: string;
};

type WaitlistEntry = {
  id: string;
  name: string;
  email: string | null;
  party_size: number;
  notified_at: string | null;
  created_at: string;
};

type Term = {
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
  price_child?: number | null;
  child_max_age?: number | null;
  status: "draft" | "published" | "cancelled";
  note: string | null;
  reservations: Reservation[];
  waitlist: WaitlistEntry[];
  waitlist_waiting: number;
};

const TIER_LABEL: Record<Reservation["pricing_tier"], string> = {
  single: "za jednoho",
  pair: "za dva",
  group: "skupinová",
};

const formatPragueTime = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/** „17:00" → {hour, minute}; cokoli jiného → null. */
const parseTimeOfDay = (value: string): { hour: number; minute: number } | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

/**
 * Pražská nástěnná hodina → UTC.
 *
 * Opak `Intl` formátování: hledá okamžik, který se v Praze zobrazí jako
 * zadaný čas. Posun se čte z té zóny, takže to drží i přes změnu času.
 */
const utcFromPragueWallClock = (parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): Date => {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  const offsetAt = (stamp: number) => {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: PRAGUE_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(stamp));
    const get = (type: string) =>
      Number(formatted.find((part) => part.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute")
    );
    return asUtc - stamp;
  };
  // Dvě kola stačí i na hodinu, kdy se posouvají hodiny.
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
};

const statusBadge = (term: Term) => {
  if (term.status === "cancelled") return <Badge color="red">Zrušený</Badge>;
  if (term.status === "published") return <Badge color="green">Vypsaný</Badge>;
  return <Badge color="grey">Koncept</Badge>;
};

const paymentBadge = (reservation: Reservation) => {
  if (reservation.status === "cancelled") {
    return <Badge color="grey">Zrušená</Badge>;
  }
  if (reservation.payment_status === "paid") {
    return (
      <Badge color="green">
        {reservation.payment_method === "online" ? "Zaplaceno kartou" : "Zaplaceno na místě"}
      </Badge>
    );
  }
  if (reservation.payment_method === "online") {
    return <Badge color="orange">Čeká na platbu</Badge>;
  }
  return <Badge color="blue">Zaplatí na místě</Badge>;
};

const people = (count: number): string =>
  count === 1 ? "1 osoba" : count < 5 ? `${count} osoby` : `${count} osob`;

/* ------------------------------------------------------------------ */
/* Účastník                                                            */
/* ------------------------------------------------------------------ */

const ParticipantRow = ({
  reservation,
  termId,
}: {
  reservation: Reservation;
  termId: string;
}) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["course-term", termId] }),
      queryClient.invalidateQueries({ queryKey: ["course-terms"] }),
    ]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<{ reservation: Reservation; email_sent: boolean }>(
        `/admin/courses/reservations/${reservation.id}`,
        { method: "PATCH", body }
      ),
    onSuccess: async (result, body) => {
      await refresh();
      if (body.payment_status === "paid") {
        toastWithUndo(
          result.email_sent
            ? "Zapsáno jako zaplacené, zákazník dostal potvrzení."
            : "Zapsáno jako zaplacené.",
          `Platba ${reservation.name}`,
          async () => {
            await sdk.client.fetch(`/admin/courses/reservations/${reservation.id}`, {
              method: "PATCH",
              body: { payment_status: "pending" },
            });
            await refresh();
          }
        );
      } else {
        toast.success("Zaplaceno odznačeno.");
      }
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Změnu se nepodařilo uložit.")),
  });

  const invoice = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ invoice: { invoice_number: string | null } }>(
        `/admin/courses/reservations/${reservation.id}/invoice`,
        { method: "POST" }
      ),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        `Faktura${result.invoice.invoice_number ? ` č. ${result.invoice.invoice_number}` : ""} vystavena a odeslána.`
      );
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Fakturu se nepodařilo vystavit.")),
  });

  const cancel = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        needs_manual_refund: boolean;
        refund: { refunded: boolean; amount: number | null } | null;
      }>(`/admin/courses/reservations/${reservation.id}/cancel`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      await refresh();
      if (result.refund?.refunded) {
        toast.success(
          `Rezervace zrušena, ${
            result.refund.amount != null ? formatCzk(result.refund.amount) : "peníze"
          } se vrací na kartu.`
        );
      } else if (result.needs_manual_refund) {
        toast.warning(
          "Rezervace zrušena, ale automatické vrácení se nepovedlo — vraťte peníze ručně."
        );
      } else {
        toast.success("Rezervace zrušena.");
      }
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Zrušení se nepodařilo.")),
  });

  const zruseno = reservation.status === "cancelled";
  const zaplaceno = reservation.payment_status === "paid";

  return (
    <div className="border-ui-border-base grid gap-x-4 gap-y-2 border-b px-6 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1.4fr)_120px_120px_minmax(0,1fr)]">
      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {reservation.name}
          <span className="text-ui-fg-muted font-normal">
            {" · "}
            {people(reservation.party_size)}
          </span>
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted truncate">
          {[reservation.phone, reservation.email].filter(Boolean).join(" · ") ||
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

      <div className="flex items-start">{paymentBadge(reservation)}</div>

      <div>
        <Text size="small" className="tabular-nums">
          {formatCzk(reservation.total_price)}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted">
          {TIER_LABEL[reservation.pricing_tier]}
        </Text>
        {/* Evidence peněz: u zaplacené online rezervace po úpravě počtu osob. */}
        {reservation.status !== "cancelled" &&
        reservation.payment_method === "online" &&
        (reservation.paid_amount ?? 0) > 0 ? (
          <Text size="xsmall" className="tabular-nums text-ui-fg-subtle">
            Zaplaceno {formatCzk(reservation.paid_amount ?? 0)}
            {(reservation.amount_due ?? 0) > 0 ? (
              <span className="text-ui-fg-error"> · zbývá {formatCzk(reservation.amount_due ?? 0)}</span>
            ) : null}
          </Text>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-end gap-2">
        {zruseno ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            {reservation.payment_status === "paid"
              ? reservation.refunded_at
                ? "zrušeno · peníze vráceny"
                : "zrušeno · vrátit peníze ručně"
              : "zrušeno"}
          </Text>
        ) : (
          <>
            {/* Peníze u dveří zapíše jen člověk, který je převzal. */}
            {!zaplaceno && reservation.payment_method === "on_site" && (
              <Button
                size="small"
                variant="secondary"
                isLoading={patch.isPending}
                onClick={() =>
                  patch.mutate({ payment_status: "paid", notify: Boolean(reservation.email) })
                }
              >
                Zapsat platbu
              </Button>
            )}
            {zaplaceno && reservation.payment_method === "on_site" && (
              <Button
                size="small"
                variant="transparent"
                isLoading={patch.isPending}
                onClick={() => patch.mutate({ payment_status: "pending" })}
              >
                Odznačit
              </Button>
            )}

            {reservation.idoklad_invoice_number ? (
              reservation.idoklad_pdf_url ? (
                <a
                  href={reservation.idoklad_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-interactive txt-small self-center hover:underline"
                >
                  Faktura {reservation.idoklad_invoice_number}
                </a>
              ) : (
                <Text size="xsmall" className="text-ui-fg-muted self-center">
                  Faktura {reservation.idoklad_invoice_number}
                </Text>
              )
            ) : zaplaceno ? (
              <Button
                size="small"
                variant="secondary"
                isLoading={invoice.isPending}
                onClick={() => invoice.mutate()}
              >
                Vystavit fakturu
              </Button>
            ) : null}

            <ConfirmDialog
              trigger={
                <Button size="small" variant="transparent" className="text-ui-fg-error">
                  Zrušit
                </Button>
              }
              title={`Zrušit rezervaci — ${reservation.name}?`}
              description={
                zaplaceno && reservation.payment_method === "online"
                  ? "Zaplacenou částku se pokusíme vrátit automaticky na kartu."
                  : "Místo se uvolní a nabídne se dalším zájemcům."
              }
              consequence={
                reservation.email
                  ? "Zákazníkovi odejde e-mail o zrušení — ten vzít zpět nejde."
                  : "Rezervace bez kontaktu — zákazníkovi se nedá dát vědět."
              }
              confirmLabel="Zrušit rezervaci"
              isPending={cancel.isPending}
              onConfirm={() => cancel.mutate()}
            />
          </>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Prezenční listina                                                   */
/* ------------------------------------------------------------------ */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatPragueDateTime = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE_TZ,
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatMinutes = (minutes: number | null): string => {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} minut`;
  const label = hours === 1 ? "hodina" : hours < 5 ? "hodiny" : "hodin";
  return rest ? `${hours} ${label} ${rest} min` : `${hours} ${label}`;
};

/**
 * Tisknutelná listina — stejné řádky jako PDF, které chodí e-mailem 12 h
 * před začátkem (`lib/course-attendance.ts`). Tisk z prohlížeče umí i
 * „Uložit jako PDF".
 */
const buildAttendanceDocument = (term: Term, rows: AttendanceRow[]): string => {
  const summary = attendanceSummary(rows);
  const when = [formatPragueDateTime(term.starts_at), formatMinutes(term.duration_minutes)]
    .filter(Boolean)
    .join(" · ");
  const body = rows
    .map(
      (row) => `<tr>
  <td class="check"><span></span></td>
  <td><strong>${escapeHtml(row.name)}</strong></td>
  <td>${escapeHtml(row.phone || "—")}</td>
  <td class="email">${escapeHtml(row.email || "—")}</td>
  <td class="num">${row.party_size}</td>
  <td class="num">${row.paid > 0 ? escapeHtml(formatKc(row.paid)) : "—"}<small>${escapeHtml(row.payment_note)}</small></td>
  <td class="num">${row.due > 0 ? `<strong>${escapeHtml(formatKc(row.due))}</strong>` : "—"}</td>
  <td>${escapeHtml(row.note)}</td>
  <td class="sign"></td>
</tr>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8">
<title>Prezenční listina — ${escapeHtml(term.title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f1e1b; margin: 0; font-size: 11px; }
  .eyebrow { font-size: 9px; letter-spacing: .08em; color: #6f7259; text-transform: uppercase; }
  h1 { font-size: 20px; margin: 4px 0 2px; }
  .meta { font-size: 12px; margin: 0 0 2px; }
  .summary { color: #6b645c; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #f3ebe1; color: #6b645c; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; text-align: left; padding: 5px 6px; }
  td { border-bottom: 1px solid #b9ad9e; padding: 7px 6px; vertical-align: top; height: 34px; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .email { word-break: break-all; }
  small { display: block; color: #6b645c; font-size: 9px; }
  .check { width: 26px; }
  .check span { display: inline-block; width: 13px; height: 13px; border: 1px solid #1f1e1b; }
  .sign { width: 130px; }
  .empty { color: #6b645c; padding: 20px 0; }
</style></head>
<body>
  <div class="eyebrow">Keramická zahrada · prezenční listina</div>
  <h1>${escapeHtml(term.title)}</h1>
  <p class="meta">${escapeHtml(when)}${term.location ? ` · ${escapeHtml(term.location)}` : ""}</p>
  <p class="summary">${escapeHtml(persons(summary.people))} · ${summary.reservations} ${
    summary.reservations >= 5 || summary.reservations === 0 ? "rezervací" : "rezervace"
  } · vybrat na místě celkem ${summary.due_total > 0 ? escapeHtml(formatKc(summary.due_total)) : "nic"}</p>
  ${
    rows.length
      ? `<table>
    <thead><tr><th></th><th>Jméno</th><th>Telefon</th><th>E-mail</th><th class="num">Osob</th><th class="num">Zaplaceno</th><th class="num">Vybrat na místě</th><th>Poznámka</th><th>Podpis</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`
      : `<p class="empty">Na termín zatím není nikdo přihlášený.</p>`
  }
</body></html>`;
};

const AttendanceButton = ({ term }: { term: Term }) => (
  <Button
    size="small"
    variant="secondary"
    onClick={() => {
      const rows = attendanceRows(term.reservations);
      const win = window.open("", "_blank");
      if (!win) {
        toast.error(
          "Prohlížeč zablokoval nové okno — povolte vyskakovací okna a zkuste to znovu."
        );
        return;
      }
      win.document.write(buildAttendanceDocument(term, rows));
      win.document.close();
      win.focus();
      // Okno se musí nejdřív vykreslit, pak teprve tisk.
      win.setTimeout(() => win.print(), 300);
    }}
  >
    Prezenční listina
  </Button>
);

/* ------------------------------------------------------------------ */
/* Napsat všem účastníkům                                              */
/* ------------------------------------------------------------------ */

/** Klíč jedné dávky — dvojklik ani opakovaný požadavek nepošle zprávu dvakrát. */
const newBatchKey = (): string => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // Starší prohlížeč — náhradní klíč níž.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const MessageDrawer = ({ term }: { term: Term }) => {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [batchKey, setBatchKey] = useState(newBatchKey);

  const { recipients, withoutEmail } = messageRecipients(term.reservations);

  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        sent: number;
        failed: string[];
        without_email: Array<{ name: string; phone: string }>;
      }>(`/admin/courses/terms/${term.id}/message`, {
        method: "POST",
        body: {
          message: message.trim(),
          subject: subject.trim() || null,
          idempotency_key: batchKey,
        },
      }),
    onSuccess: (result) => {
      if (result.failed.length) {
        toast.warning(
          `Odesláno ${result.sent}×. Nepodařilo se: ${result.failed.join(", ")} — zkuste to znovu v Přehled → Odeslané e-maily.`,
          { duration: 15000 }
        );
      } else {
        toast.success(
          `Zpráva odešla ${result.sent === 1 ? "1 účastníkovi" : `${result.sent} účastníkům`}.`
        );
      }
      if (result.without_email.length) {
        toast.info(
          `Bez e-mailu — zavolejte jim: ${result.without_email
            .map((person) => (person.phone ? `${person.name} (${person.phone})` : person.name))
            .join(", ")}`,
          { duration: 15000 }
        );
      }
      setOpen(false);
      setSubject("");
      setMessage("");
      setBatchKey(newBatchKey());
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Zprávu se nepodařilo odeslat.")),
  });

  const count = recipients.length;
  const valid = message.trim().length >= 3 && count > 0;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">
          Napsat všem
        </Button>
      </Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Napsat všem účastníkům</Drawer.Title>
          <Drawer.Description>
            Třeba „zpozdím se o 30 minut“ nebo „přineste si zástěru“. Každý
            dostane e-mail s oslovením, údaji o kurzu a vaším podpisem.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-5">
            <div className="bg-ui-bg-subtle rounded-lg px-4 py-3">
              <Text size="small" weight="plus">
                {term.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                {formatPragueDateTime(term.starts_at)} · {term.location}
              </Text>
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="course-message-text">Zpráva</Label>
              <Textarea
                id="course-message-text"
                rows={7}
                value={message}
                placeholder="Omlouvám se, zdržím se asi o 30 minut — začneme v 10:30."
                onChange={(event) => setMessage(event.target.value)}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Oslovení („Dobrý den, …“) a podpis doplníme sami.
              </Text>
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="course-message-subject">Předmět (nepovinné)</Label>
              <Input
                id="course-message-subject"
                value={subject}
                placeholder={`Zpráva ke kurzu ${term.title}`}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Text size="small" weight="plus">
                {count === 0
                  ? "Nikdo z přihlášených nemá e-mail."
                  : `Odejde ${count === 1 ? "1 člověku" : `${count} lidem`}:`}
              </Text>
              {count > 0 && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {recipients.map((recipient) => recipient.name).join(", ")}
                </Text>
              )}
              {withoutEmail.length > 0 && (
                <Text size="xsmall" className="text-ui-fg-error mt-1">
                  Bez e-mailu — těm zavolejte:{" "}
                  {withoutEmail
                    .map((person) => (person.phone ? `${person.name} (${person.phone})` : person.name))
                    .join(", ")}
                </Text>
              )}
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zavřít
          </Button>
          <Button
            variant="primary"
            isLoading={send.isPending}
            disabled={!valid || send.isPending}
            onClick={() => send.mutate()}
          >
            {count > 0 ? `Odeslat (${count})` : "Odeslat"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */
/* Stránka                                                             */
/* ------------------------------------------------------------------ */

const TermDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{ term: Term }>({
    queryKey: ["course-term", id],
    queryFn: () => sdk.client.fetch(`/admin/courses/terms/${id}`),
    enabled: Boolean(id),
  });

  const term = data?.term;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["course-term", id] }),
      queryClient.invalidateQueries({ queryKey: ["course-terms"] }),
    ]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/courses/terms/${id}`, { method: "PATCH", body }),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  const cancelTerm = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        emails_sent: number;
        refunds: {
          refunded_count: number;
          manual_count: number;
          manual_names: string[];
        };
      }>(`/admin/courses/terms/${id}/cancel`, { method: "POST" }),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        `Termín zrušen. Odesláno ${result.emails_sent} e-mailů přihlášeným.` +
          (result.refunds.refunded_count
            ? ` ${result.refunds.refunded_count}× se peníze vrací na kartu.`
            : "")
      );
      /* Komu je potřeba vrátit peníze z ruky — jmenovitě, ne počtem. */
      if (result.refunds.manual_count) {
        toast.warning(
          `Peníze vraťte ručně: ${result.refunds.manual_names.join(", ")}`,
          { duration: 15000 }
        );
      }
    },
    onError: (error) => toast.error(ceskaChyba(error, "Zrušení se nepodařilo.")),
  });

  if (isLoading) {
    return (
      <Container className="flex flex-col gap-y-3 p-6">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </Container>
    );
  }

  if (isError || !term) {
    return (
      <Container className="p-0">
        <EmptyState
          title="Termín se nepodařilo načíst"
          description="Možná byl smazán. Zkuste se vrátit na seznam kurzů."
          action={
            <Button size="small" variant="secondary" asChild>
              <Link to="/kurzy-sprava">Zpět na Kurzy</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const zruseny = term.status === "cancelled";
  const aktivni = term.reservations.filter((r) => r.status !== "cancelled");
  const zrusene = term.reservations.filter((r) => r.status === "cancelled");
  const zaplaceno = aktivni.filter((r) => r.payment_status === "paid");
  // Skutečně vybráno: evidence peněz (doplatky i vrácené), u starších řádků cena.
  const vybrano = aktivni.reduce(
    (sum, r) => sum + (r.paid_amount ?? (r.payment_status === "paid" ? r.total_price : 0)),
    0
  );
  void zaplaceno;
  const ocekavano = aktivni.reduce((sum, r) => sum + r.total_price, 0);

  const dayKey = pragueDayKey(term.starts_at);

  /** Datum a čas se ukládají společně — oboje je jeden okamžik. */
  const saveMoment = (nextDay: string, nextTime: string) => {
    const clock = parseTimeOfDay(nextTime);
    if (!clock) {
      toast.error("Čas zadejte ve tvaru 17:00.");
      return;
    }
    const { year, month, day } = parseDayKey(nextDay);
    patch.mutate({
      starts_at: utcFromPragueWallClock({ year, month, day, ...clock }).toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
          <div className="min-w-0">
            <Link
              to="/kurzy-sprava"
              className="text-ui-fg-subtle txt-small hover:text-ui-fg-base mb-2 inline-flex items-center gap-1"
            >
              <ArrowUturnLeft /> Zpět na Kurzy
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Heading>{term.title}</Heading>
              {statusBadge(term)}
            </div>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {dayLabel(dayKey)} v {formatPragueTime(term.starts_at)} · {term.location}
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!zruseny && (
              <ConfirmDialog
                trigger={
                  <Button size="small" variant="danger">
                    Zrušit termín
                  </Button>
                }
                title="Zrušit celý termín?"
                description={
                  aktivni.length
                    ? [
                        "Všem přihlášeným odejde e-mail s omluvou a odkazem na další termíny.",
                        aktivni.some(
                          (r) =>
                            r.payment_status === "paid" &&
                            r.payment_method === "online"
                        )
                          ? "Platby kartou se pokusíme vrátit automaticky."
                          : "",
                        /* Hotovost se automaticky vrátit nedá — ať to ví
                           dřív, než klikne, a ne až z hlášky potom. */
                        aktivni.some(
                          (r) =>
                            r.payment_status === "paid" &&
                            r.payment_method === "on_site"
                        )
                          ? "Kdo platil hotově na místě, tomu peníze vrátíte osobně — napíšeme vám, komu."
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Na termín není nikdo přihlášený."
                }
                items={aktivni.map(
                  (r) => `${r.name} · ${people(r.party_size)}`
                )}
                consequence="Odeslané e-maily o zrušení už nejde vzít zpět."
                confirmLabel="Zrušit termín"
                isPending={cancelTerm.isPending}
                onConfirm={() => cancelTerm.mutate()}
              />
            )}
          </div>
        </header>

        {/* Obsazenost a peníze — to, na co se při otevření kouká první. */}
        <section className="grid gap-px bg-ui-border-base grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          <div className="bg-ui-bg-base px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              Obsazenost
            </Text>
            <Heading level="h2" className="mt-1 tabular-nums">
              {term.seats_taken}/{term.capacity}
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              {term.seats_left > 0
                ? `zbývá ${term.seats_left === 1 ? "1 místo" : term.seats_left < 5 ? `${term.seats_left} místa` : `${term.seats_left} míst`}`
                : "obsazeno"}
            </Text>
          </div>
          <div className="bg-ui-bg-base px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              Vybráno
            </Text>
            <Heading level="h2" className="mt-1 tabular-nums">
              {formatCzk(vybrano)}
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              {vybrano < ocekavano
                ? `čeká se ještě na ${formatCzk(ocekavano - vybrano)}`
                : aktivni.length
                  ? "všechno zaplaceno"
                  : "zatím nic"}
            </Text>
          </div>
          {term.waitlist_waiting > 0 && (
            <div className="bg-ui-bg-base px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                Čekají na místo
              </Text>
              <Heading level="h2" className="mt-1 tabular-nums">
                {term.waitlist_waiting}
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-0.5">
                ozveme se jim, až se místo uvolní
              </Text>
            </div>
          )}
        </section>
      </Container>

      {/* ---------------------------------------------------- Údaje */}
      <Container className="divide-y p-0">
        <header className="px-6 pb-3 pt-5">
          <Heading level="h2">Kdy, kde a za kolik</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {zruseny
              ? "Zrušený termín už upravovat nejde."
              : "Ukládá se při opuštění pole — žádné tlačítko navíc."}
          </Text>
        </header>

        <div className="grid gap-x-6 gap-y-4 px-6 py-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Pole label="Název">
              <InlineText
                value={term.title}
                required
                onSave={(next) => patch.mutateAsync({ title: next })}
              />
            </Pole>
            <Pole label="Místo">
              <InlineText
                value={term.location}
                required
                onSave={(next) => patch.mutateAsync({ location: next })}
              />
            </Pole>
            <Pole label="Začátek">
              <DayTime
                dayKey={dayKey}
                time={formatPragueTime(term.starts_at)}
                disabled={zruseny}
                onChange={saveMoment}
              />
            </Pole>
            <Pole label="Délka">
              <InlineNumber
                value={term.duration_minutes}
                unit="minut"
                inputClassName="w-24"
                onSave={(next) =>
                  patch.mutateAsync({ duration_minutes: Number(next) })
                }
              />
            </Pole>
            <Pole label="Kapacita">
              <InlineNumber
                value={term.capacity}
                unit="osob"
                allowEmpty={false}
                inputClassName="w-24"
                onSave={(next) => patch.mutateAsync({ capacity: next })}
              />
            </Pole>
          </div>

          <div className="flex flex-col gap-3">
            {/* Jen dospělý a dítě — ceny za dva a za skupinu jsou od
                13. 11. 2026 zrušené (modules/course/pricing.ts). */}
            <Pole label="Dospělý (za osobu)">
              <InlineNumber
                value={term.price_single}
                unit="Kč"
                allowEmpty={false}
                inputClassName="w-28"
                onSave={(next) => patch.mutateAsync({ price_single: next })}
              />
            </Pole>
            <Pole label="Dítě (za osobu)">
              <InlineNumber
                value={term.price_child ?? null}
                unit="Kč"
                inputClassName="w-28"
                onSave={(next) => patch.mutateAsync({ price_child: next })}
              />
            </Pole>
            <Pole label="Dítě do">
              <InlineNumber
                value={term.child_max_age ?? null}
                unit="let"
                inputClassName="w-24"
                onSave={(next) => patch.mutateAsync({ child_max_age: next })}
              />
            </Pole>
            <Pole label="Poznámka">
              <InlineTextarea
                value={term.note ?? ""}
                placeholder="co s sebou — přijde účastníkům v připomínce 3 dny předem"
                onSave={(next) => patch.mutateAsync({ note: next || null })}
              />
            </Pole>
          </div>
        </div>
      </Container>

      {/* ----------------------------------------------- Účastníci */}
      <Container className="divide-y p-0">
        <header className="flex flex-wrap items-center justify-between gap-2 px-6 pb-3 pt-5">
          <div>
            <Heading level="h2">
              Účastníci {aktivni.length > 0 ? `(${aktivni.length})` : ""}
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Kdo přijde, kolik platí a jestli už zaplatil.
              {!zruseny && aktivni.length > 0 && new Date(term.starts_at).getTime() > Date.now()
                ? " Prezenční listina vám navíc přijde e-mailem 12 hodin před začátkem."
                : ""}
            </Text>
          </div>
          {!zruseny && aktivni.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <AttendanceButton term={term} />
              <MessageDrawer term={term} />
            </div>
          )}
        </header>

        {aktivni.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              Zatím se nikdo nepřihlásil. Koho domluvíte po telefonu, zapíšete
              v seznamu kurzů tlačítkem „Zapsat rezervaci“.
            </Text>
          </div>
        ) : (
          <div>
            {aktivni.map((reservation) => (
              <ParticipantRow
                key={reservation.id}
                reservation={reservation}
                termId={term.id}
              />
            ))}
          </div>
        )}

        {zrusene.length > 0 && (
          <details className="px-6 py-3">
            <summary className="text-ui-fg-subtle txt-small cursor-pointer select-none">
              Zrušené rezervace ({zrusene.length})
            </summary>
            <div className="mt-2">
              {zrusene.map((reservation) => (
                <ParticipantRow
                  key={reservation.id}
                  reservation={reservation}
                  termId={term.id}
                />
              ))}
            </div>
          </details>
        )}
      </Container>

      {/* ------------------------------------------- Čekací listina */}
      {term.waitlist.length > 0 && (
        <Container className="divide-y p-0">
          <header className="px-6 pb-3 pt-5">
            <Heading level="h2">Čekají na místo ({term.waitlist.length})</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Jakmile se místo uvolní, ozveme se jim sami — v pořadí, v jakém
              se přihlásili.
            </Text>
          </header>
          <div className="divide-y">
            {term.waitlist.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 px-6 py-3"
              >
                <div className="min-w-0">
                  <Text size="small" weight="plus" className="truncate">
                    {entry.name}
                    <span className="text-ui-fg-muted font-normal">
                      {" · "}
                      {people(entry.party_size)}
                    </span>
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted truncate">
                    {entry.email ?? "bez e-mailu"}
                  </Text>
                </div>
                {entry.notified_at ? (
                  <Badge size="2xsmall" color="green">
                    Dali jsme vědět
                  </Badge>
                ) : (
                  <Badge size="2xsmall" color="grey">
                    Čeká
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Container>
      )}

    </div>
  );
};

/** Popisek vlevo, hodnota vpravo — stejné rozvržení ve všech kartách. */
const Pole = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid items-start gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
    <Text size="xsmall" weight="plus" className="text-ui-fg-muted pt-1.5 uppercase">
      {label}
    </Text>
    <div className="min-w-0">{children}</div>
  </div>
);

/**
 * Den a čas dohromady.
 *
 * Datum se vybírá v kalendáři (ne psaním — „31. 2." by se jinak uložilo),
 * čas se píše. Uloží se až obojí najednou, protože je to jeden okamžik.
 */
const DayTime = ({
  dayKey,
  time,
  disabled,
  onChange,
}: {
  dayKey: string;
  time: string;
  disabled?: boolean;
  onChange: (day: string, time: string) => void;
}) => {
  const [draftTime, setDraftTime] = useState(time);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Picker umí víc dnů (zakládání série); tady je potřeba jeden —
          bere se ten nově přibylý, ne celé pole. */}
      <CourseDayPicker
        selected={[dayKey]}
        onChange={(next) => {
          const pridany = next.find((key) => key !== dayKey) ?? next[0];
          if (pridany && pridany !== dayKey && !disabled) {
            onChange(pridany, draftTime);
          }
        }}
      />
      <Input
        size="small"
        className="w-20"
        value={draftTime}
        disabled={disabled}
        onChange={(event) => setDraftTime(event.target.value)}
        onBlur={() => {
          if (draftTime !== time) onChange(dayKey, draftTime);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
};

const queryClient = adminQueryClient;

const TermDetailPage = () => (
  <QueryClientProvider client={queryClient}>
    <TermDetail />
  </QueryClientProvider>
);

export default TermDetailPage;
