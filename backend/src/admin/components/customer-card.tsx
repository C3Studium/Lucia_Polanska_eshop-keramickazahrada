import { Badge, Button, Skeleton, Text, Textarea, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { sdk } from "../lib/sdk";
import { formatCount, formatCzk } from "../lib/workbench";
import { formatDate } from "../lib/format";
import { ceskaChyba } from "../lib/ceska-chyba";
import { RawData } from "../lib/expert-mode";
import { LOYALTY_DEFAULTS, LoyaltyCodePanel } from "./loyalty-code-panel";

/**
 * Karta zákazníka — „kdo je to pro obchod?" na jednom místě.
 *
 * Sdílí ji Zákazníci+ (výsuvná Karta) i widget na nativním detailu
 * zákazníka. Pravidlo 20/80: nahoře čtyři čísla, odznak stálého zákazníka,
 * tlačítko „Poslat slevový kód" a poznámka; zbytek (objednávky, reklamace,
 * kurzy a poukazy, poslané kódy, e-maily) je rozbalovací.
 *
 * Data: `GET /admin/workbench/customers/:id`. Starší server (před restartem)
 * vrací jen objednávky — hlavní čísla se pak dopočítají z nich a doplňky
 * se prostě neukážou.
 */

type CardOrder = {
  id: string;
  display_id: number | string;
  created_at: string;
  total: number;
  stage: string | null;
  made_to_order: boolean;
  outstanding: number;
  canceled?: boolean;
  paid?: boolean;
};

type CardCode = {
  code: string;
  percentage: number | null;
  kind: "auto" | "manual";
  created_at: string | null;
  ends_at: string | null;
  state: "active" | "used" | "expired";
};

export type CustomerCardData = {
  id: string;
  email: string | null;
  name: string | null;
  note: string | null;
  has_account?: boolean;
  summary?: {
    orders_count: number;
    paid_orders_count: number;
    total_spent: number;
    last_order_at: string | null;
    outstanding: number;
    canceled_count: number;
  };
  claims?: {
    count: number;
    open: number;
    last: {
      created_at: string;
      kind: string | null;
      status: string | null;
      order_display_id: string | null;
    } | null;
  } | null;
  courses?: { count: number; last_at: string | null } | null;
  vouchers?: { count: number; total: number } | null;
  newsletter_state?: "confirmed" | "pending" | "unsubscribed" | null;
  codes?: CardCode[];
  loyalty?: { after_orders: number } | null;
  code_blocked_reason?: string | null;
  orders: CardOrder[];
};

export const customerCardKey = (customerId: string) => ["workbench-customer-full", customerId];

export const useCustomerCard = (customerId: string, enabled = true) =>
  useQuery<CustomerCardData>({
    queryKey: customerCardKey(customerId),
    queryFn: () => sdk.client.fetch(`/admin/workbench/customers/${customerId}`),
    enabled,
  });

/** „Stálý zákazník" od stejné hranice, od které chodí kód (výchozí 3). */
export const isRegularCustomer = (ordersCount: number, threshold?: number | null) =>
  ordersCount >= (threshold ?? LOYALTY_DEFAULTS.after_orders);

export const RegularCustomerBadge = ({ ordersCount }: { ordersCount: number }) => (
  <Badge size="2xsmall" color="purple">
    Stálý zákazník · {ordersCount}. nákup
  </Badge>
);

/** Hlavní čísla; ze starší odpovědi serveru (bez `summary`) z objednávek. */
const summaryOf = (data: CustomerCardData) => {
  if (data.summary) return data.summary;
  const live = data.orders.filter((order) => !order.canceled);
  return {
    orders_count: live.length,
    paid_orders_count: live.filter((order) => order.paid).length,
    total_spent: live.reduce((sum, order) => sum + (order.total || 0), 0),
    last_order_at: live[0]?.created_at ?? null,
    outstanding: live.reduce((sum, order) => sum + (order.outstanding || 0), 0),
    canceled_count: data.orders.length - live.length,
  };
};

const CLAIM_KIND: Record<string, string> = {
  reklamace: "reklamace",
  vraceni: "vrácení",
  odstoupeni: "odstoupení od smlouvy",
};

const CLAIM_STATUS: Record<string, string> = {
  pending: "čeká na schválení",
  approved: "schváleno",
  received: "zboží dorazilo",
  resolved: "vyřízeno",
  rejected: "zamítnuto",
  cancelled: "zrušeno",
};

const CODE_STATE = (code: CardCode) =>
  code.state === "used"
    ? "použitý"
    : code.state === "expired"
      ? "už neplatí"
      : code.ends_at
        ? `platí do ${formatDate(code.ends_at)}`
        : "platí";

const NEWSLETTER_LABEL: Record<string, string> = {
  confirmed: "odebírá newsletter",
  pending: "newsletter nepotvrdil",
  unsubscribed: "z newsletteru se odhlásil",
};

const Stat = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "red";
}) => (
  <div className="bg-ui-bg-subtle rounded-lg px-3 py-2">
    <Text size="xsmall" className="text-ui-fg-muted">
      {label}
    </Text>
    <Text size="small" weight="plus" className={tone === "red" ? "text-ui-fg-error" : undefined}>
      {value}
    </Text>
    {hint ? (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {hint}
      </Text>
    ) : null}
  </div>
);

/** Rozbalovací oddíl — „zbytek" z pravidla 20/80. */
const Fold = ({ title, children }: { title: ReactNode; children: ReactNode }) => (
  <details className="border-ui-border-base rounded-lg border">
    <summary className="txt-small text-ui-fg-base cursor-pointer select-none px-3 py-2 font-medium">
      {title}
    </summary>
    <div className="flex flex-col gap-y-1.5 px-3 pb-3">{children}</div>
  </details>
);

const NoteEditor = ({ customerId, stored }: { customerId: string; stored: string }) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(stored);
  useEffect(() => setNote(stored), [stored]);

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/customers/${customerId}`, {
        method: "POST",
        body: {
          // Medusa metadata slučuje: posílá se jen poznámka, ne celý objekt
          // (starý snímek by přepsal, co mezitím zapsal někdo jiný). Prázdný
          // text klíč smaže; starší klíč `poznamka` se tím uklidí.
          metadata: { note: note.trim() || "", poznamka: "" },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerCardKey(customerId) });
      toast.success("Poznámka uložena.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Poznámku se nepodařilo uložit")),
  });

  return (
    <div>
      <Text size="small" weight="plus">
        Poznámka (vidíte jen vy)
      </Text>
      <Textarea
        rows={3}
        className="mt-2"
        placeholder="Např. sbírá modrou sérii, preferuje osobní odběr, balit jako dárek…"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        size="small"
        variant="secondary"
        className="mt-2"
        disabled={note.trim() === stored.trim()}
        isLoading={save.isPending}
        onClick={() => save.mutate()}
      >
        Uložit poznámku
      </Button>
    </div>
  );
};

const SentEmails = ({ customerId }: { customerId: string }) => {
  const { data, isLoading } = useQuery<{
    emails: { template: string; status: string; created_at: string }[];
  }>({
    queryKey: ["workbench-customer-emails", customerId],
    queryFn: () => sdk.client.fetch(`/admin/workbench/customers/${customerId}/emails`),
  });
  if (isLoading) return <Skeleton className="h-8 rounded-lg" />;
  if (!data?.emails.length) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        Tomuto zákazníkovi zatím nic neodešlo.
      </Text>
    );
  }
  return (
    <>
      {data.emails.map((email, index) => (
        <Text key={index} size="xsmall">
          {email.template}
          {email.status === "failure" ? " · NEDORUČENO" : ""}{" "}
          <span className="text-ui-fg-muted">{formatDate(email.created_at)}</span>
        </Text>
      ))}
    </>
  );
};

export const CustomerCard = ({
  customerId,
  showOrders = true,
  showEmails = true,
  initialCodeOpen = false,
}: {
  customerId: string;
  /** Na nativním detailu zákazníka seznam objednávek už je — tam se vynechá. */
  showOrders?: boolean;
  showEmails?: boolean;
  /** Otevřít rovnou „Poslat slevový kód" (z tlačítka v řádku seznamu). */
  initialCodeOpen?: boolean;
}) => {
  const { data, isLoading, isError } = useCustomerCard(customerId);
  const [codeOpen, setCodeOpen] = useState(initialCodeOpen);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-y-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Text size="small" className="text-ui-fg-error">
        Kartu zákazníka se nepodařilo načíst. Zkuste stránku obnovit.
      </Text>
    );
  }

  const summary = summaryOf(data);
  const threshold = data.loyalty?.after_orders;
  const name = data.name || data.email || "zákazník";
  const codes = data.codes ?? [];
  const claims = data.claims;
  const extras = [
    data.courses && data.courses.count > 0
      ? `${formatCount(data.courses.count, "rezervace kurzu", "rezervace kurzů", "rezervací kurzů")}${
          data.courses.last_at ? ` (naposledy ${formatDate(data.courses.last_at)})` : ""
        }`
      : null,
    data.vouchers && data.vouchers.count > 0
      ? `${formatCount(data.vouchers.count, "koupený dárkový poukaz", "koupené dárkové poukazy", "koupených dárkových poukazů")} za ${formatCzk(data.vouchers.total)}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {isRegularCustomer(summary.orders_count, threshold) && (
          <RegularCustomerBadge ordersCount={summary.orders_count} />
        )}
        {data.has_account === true && (
          <Badge size="2xsmall" color="grey">
            má účet
          </Badge>
        )}
        {data.has_account === false && (
          <Badge size="2xsmall" color="grey">
            nakupuje bez účtu
          </Badge>
        )}
        {data.newsletter_state && (
          <Badge size="2xsmall" color={data.newsletter_state === "confirmed" ? "green" : "grey"}>
            {NEWSLETTER_LABEL[data.newsletter_state]}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Objednávky"
          value={summary.orders_count === 0 ? "zatím žádná" : summary.orders_count}
          hint={
            summary.canceled_count > 0
              ? `+ ${formatCount(summary.canceled_count, "zrušená", "zrušené", "zrušených")}`
              : summary.orders_count > 0 && data.summary
                ? `z toho ${formatCount(summary.paid_orders_count, "zaplacená", "zaplacené", "zaplacených")}`
                : undefined
          }
        />
        <Stat label="Utraceno celkem" value={formatCzk(summary.total_spent)} />
        <Stat
          label="Poslední nákup"
          value={summary.last_order_at ? formatDate(summary.last_order_at) : "—"}
        />
        <Stat
          label="Doplatky zakázek"
          value={summary.outstanding > 0 ? `dluží ${formatCzk(summary.outstanding)}` : "nic nedluží"}
          tone={summary.outstanding > 0 ? "red" : undefined}
        />
      </div>

      {claims && claims.count > 0 && (
        <Text size="xsmall" className={claims.open > 0 ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
          {formatCount(claims.count, "reklamace / vrácení", "reklamace / vrácení", "reklamací / vrácení")}
          {claims.open > 0
            ? ` — ${formatCount(claims.open, "nevyřízená", "nevyřízené", "nevyřízených")}`
            : ""}
          {claims.last
            ? ` · poslední ${formatDate(claims.last.created_at)} (${
                CLAIM_KIND[claims.last.kind ?? ""] ?? "žádost"
              }, ${CLAIM_STATUS[claims.last.status ?? ""] ?? claims.last.status ?? "—"})`
            : ""}
        </Text>
      )}

      {codeOpen ? (
        <LoyaltyCodePanel
          customerId={customerId}
          customerName={name}
          blockedReason={data.code_blocked_reason}
          onClose={() => setCodeOpen(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="small" variant="secondary" onClick={() => setCodeOpen(true)}>
            Poslat slevový kód
          </Button>
          {data.email && (
            <Button size="small" variant="transparent" asChild>
              <a href={`mailto:${data.email}`}>Napsat e-mail</a>
            </Button>
          )}
          {codes[0] && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Naposledy kód {codes[0].code} ({CODE_STATE(codes[0])})
            </Text>
          )}
        </div>
      )}

      <NoteEditor customerId={customerId} stored={data.note ?? ""} />

      <div className="flex flex-col gap-y-2">
        {showOrders && (
          <Fold title={`Objednávky (${data.orders.length})`}>
            {data.orders.length === 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Zatím žádná objednávka.
              </Text>
            )}
            {data.orders.map((order) => (
              <Text key={order.id} size="xsmall">
                <Link to={`/orders/${order.id}`} className="text-ui-fg-interactive hover:underline">
                  #{order.display_id}
                </Link>{" "}
                · {formatCzk(order.total)} · {formatDate(order.created_at)}
                {order.canceled ? " · zrušená" : ""}
                {order.made_to_order ? " · zakázka" : ""}
                {order.outstanding > 0 ? ` · dluží ${formatCzk(order.outstanding)}` : ""}
              </Text>
            ))}
          </Fold>
        )}

        {claims && (
          <Fold title={`Reklamace a vrácení (${claims.count})`}>
            {claims.count === 0 ? (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Žádná reklamace ani vrácení.
              </Text>
            ) : (
              <Text size="xsmall">
                Poslední: {claims.last ? formatDate(claims.last.created_at) : "—"}
                {claims.last?.order_display_id ? ` · objednávka #${claims.last.order_display_id}` : ""}
                {" · "}
                <Link to="/reklamace" className="text-ui-fg-interactive hover:underline">
                  otevřít Reklamace
                </Link>
              </Text>
            )}
          </Fold>
        )}

        {(data.courses || data.vouchers) && (
          <Fold title="Kurzy a dárkové poukazy">
            {extras.length === 0 ? (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Žádný kurz ani koupený poukaz.
              </Text>
            ) : (
              extras.map((line) => (
                <Text key={line} size="xsmall">
                  {line}
                </Text>
              ))
            )}
          </Fold>
        )}

        {data.codes && (
          <Fold title={`Poslané slevové kódy (${codes.length})`}>
            {codes.length === 0 ? (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Zatím žádný kód.
              </Text>
            ) : (
              codes.map((code) => (
                <Text key={`${code.code}-${code.created_at}`} size="xsmall">
                  {code.code}
                  {code.percentage !== null ? ` · ${code.percentage} %` : ""} · {CODE_STATE(code)}
                  {code.kind === "auto" ? " · poslán automaticky" : ""}
                  {code.created_at ? (
                    <span className="text-ui-fg-muted"> · {formatDate(code.created_at)}</span>
                  ) : null}
                </Text>
              ))
            )}
          </Fold>
        )}

        {showEmails && (
          <Fold title="Odeslané e-maily">
            <SentEmails customerId={customerId} />
          </Fold>
        )}
      </div>

      <RawData data={data} />
    </div>
  );
};
