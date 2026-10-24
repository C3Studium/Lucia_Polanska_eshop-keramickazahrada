import { Badge, Text, toast } from "@medusajs/ui";
import { SquareTwoStack } from "@medusajs/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";

/**
 * Společné kousky stránky Poukazy (seznam, nový poukaz, detail).
 *
 * Stavy a popisky si stránka bere z odpovědi serveru (`state`, `state_label`),
 * takže se nerozejdou s e-maily a stránkou poukazu na webu. Tady jsou jen
 * barvy a české formátování. `modules/gift-voucher/code.ts` se sem
 * schválně neimportuje — tahá `crypto` z Node, a to do prohlížeče nepatří.
 */

export type VoucherState = "pending_payment" | "active" | "used" | "expired" | "cancelled" | "refunded";

export type GiftVoucherRedemption = {
  id: string;
  amount: number;
  order_id: string | null;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  reverse_note: string | null;
};

export type AdminGiftVoucher = {
  id: string;
  code: string;
  kind: "physical" | "electronic";
  initial_value: number;
  balance: number;
  currency_code: string;
  valid_until: string;
  recipient_name: string | null;
  recipient_email: string | null;
  dedication: string | null;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  note: string | null;
  payment_method: "cash" | "transfer" | "comgate" | "order";
  payment_method_label: string;
  payment_status: "pending" | "paid";
  paid_at: string | null;
  payment_url: string | null;
  order_id: string | null;
  status: "active" | "cancelled";
  cancelled_at: string | null;
  /** Peníze za poukaz vrácené → spotřebovaný natrvalo. */
  refunded_at?: string | null;
  refund_note?: string | null;
  /** Koupený v objednávce z obchodu (`{line_item_id}#{n}`). */
  order_line_item_id?: string | null;
  sent_at: string | null;
  sent_to: string | null;
  created_at: string;
  state: VoucherState;
  state_label: string;
  page_url: string;
  redemptions: GiftVoucherRedemption[];
};

export type GiftVoucherListResponse = {
  gift_vouchers: AdminGiftVoucher[];
  summary: {
    count: number;
    active: number;
    pending_payment: number;
    outstanding_balance: number;
  };
};

/** Co server vrací po vystavení i po každé akci. */
export type GiftVoucherOutcome = {
  gift_voucher: AdminGiftVoucher;
  payment_url?: string;
  email?: string;
  warning?: string;
};

export const VOUCHER_LIMITS = { min: 100, max: 50000 } as const;

export const STATE_BADGE: Record<
  VoucherState,
  { label: string; color: "orange" | "green" | "grey" | "red" }
> = {
  pending_payment: { label: "Čeká na platbu", color: "orange" },
  active: { label: "Platný", color: "green" },
  used: { label: "Vyčerpaný", color: "grey" },
  expired: { label: "Propadlý", color: "red" },
  cancelled: { label: "Zrušený", color: "grey" },
  refunded: { label: "Peníze vráceny", color: "red" },
};

export const StateBadge = ({ voucher }: { voucher: Pick<AdminGiftVoucher, "state" | "state_label"> }) => {
  const badge = STATE_BADGE[voucher.state] ?? STATE_BADGE.active;
  return (
    <Badge size="2xsmall" color={badge.color}>
      {voucher.state_label || badge.label}
    </Badge>
  );
};

export const KIND_LABEL: Record<AdminGiftVoucher["kind"], string> = {
  physical: "Vytištěný",
  electronic: "Elektronický",
};

/* ------------------------------------------------------------------ */
/* Datumy                                                              */
/* ------------------------------------------------------------------ */

/**
 * Konec platnosti ukládá server jako „den, 22:59:59 UTC" — to je ten den,
 * který se zadal. Pražský čas by v létě ukázal o den víc (00:59 dalšího
 * dne), proto se den platnosti čte v UTC.
 */
export const formatValidUntil = (value: string | null | undefined): string => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

/** Den platnosti jako hodnota pro `<input type="date">` (RRRR-MM-DD). */
export const validUntilInput = (value: string | null | undefined): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

/** Dnešek v Praze jako RRRR-MM-DD. */
export const todayInput = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Dnešek + `months` měsíců jako RRRR-MM-DD. */
export const monthsFromTodayInput = (months: number): string => {
  const [y, m, d] = todayInput().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  // 31. 1. + 1 měsíc by přeteklo do března — vezme se poslední den měsíce.
  if (date.getUTCDate() !== d) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

/* ------------------------------------------------------------------ */
/* Drobnosti                                                           */
/* ------------------------------------------------------------------ */

export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const copyText = (value: string, what: string) => {
  if (!navigator.clipboard) {
    toast.error("Kopírování tady nejde — označte text a zkopírujte ho ručně.");
    return;
  }
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${what} zkopírován`))
    .catch(() => toast.error("Kopírování se nepovedlo — označte text a zkopírujte ho ručně."));
};

export const CopyButton = ({
  value,
  what,
  label,
  className,
}: {
  value: string;
  /** „Kód", „Odkaz" — do potvrzení „Kód zkopírován". */
  what: string;
  /** Viditelný text vedle ikonky; bez něj jen ikonka. */
  label?: string;
  className?: string;
}) => (
  <button
    type="button"
    title={`Zkopírovat ${what.toLowerCase()}`}
    aria-label={`Zkopírovat ${what.toLowerCase()}`}
    className={`text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover inline-flex shrink-0 items-center gap-x-1 rounded-md p-1.5 ${className ?? ""}`}
    onClick={(event) => {
      event.stopPropagation();
      copyText(value, what);
    }}
  >
    <SquareTwoStack />
    {label ? <span className="txt-compact-small">{label}</span> : null}
  </button>
);

/** Stránka poukazu na webu (zaplatit / zobrazit / vytisknout). */
export const openVoucherPage = (voucher: Pick<AdminGiftVoucher, "page_url">) => {
  if (!voucher.page_url) {
    toast.error("Odkaz na stránku poukazu chybí.");
    return;
  }
  window.open(voucher.page_url, "_blank", "noopener");
};

/** Relativní odkaz = server nezná adresu obchodu; otevřel by se v administraci. */
export const pageUrlIsRelative = (voucher: Pick<AdminGiftVoucher, "page_url">) =>
  Boolean(voucher.page_url) && voucher.page_url.startsWith("/");

/** Toasty po zápisu: co odešlo e-mailem (zeleně) a co se nepovedlo (oranžově). */
export const announceOutcome = (outcome: Partial<GiftVoucherOutcome>, success?: string) => {
  if (success) toast.success(success);
  if (outcome.email) toast.success(outcome.email);
  if (outcome.warning) toast.warning(outcome.warning);
};

export const invalidateVouchers = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["gift-vouchers"] });

/** Akce nad poukazem (`POST /admin/gift-vouchers/:id/actions`). */
export const useVoucherAction = (
  voucherId: string,
  options: {
    success?: (outcome: GiftVoucherOutcome) => string | undefined;
    fallback: string;
    onDone?: (outcome: GiftVoucherOutcome) => void;
  }
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<GiftVoucherOutcome>(`/admin/gift-vouchers/${voucherId}/actions`, {
        method: "POST",
        body,
      }),
    onSuccess: async (outcome) => {
      queryClient.setQueryData(["gift-vouchers", "detail", voucherId], {
        gift_voucher: outcome.gift_voucher,
      });
      await invalidateVouchers(queryClient);
      announceOutcome(outcome, options.success?.(outcome));
      options.onDone?.(outcome);
    },
    onError: (error) => toast.error(ceskaChyba(error, options.fallback)),
  });
};

/** Řádek „popisek — hodnota" v detailu. */
export const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-y-0.5">
    <Text size="xsmall" className="text-ui-fg-muted">
      {label}
    </Text>
    <div className="txt-small text-ui-fg-base break-words">{children}</div>
  </div>
);

/** Velký výběr ze dvou až tří možností (typ poukazu, platba). */
export const ChoiceCards = <T extends string>({
  value,
  options,
  onChange,
  name,
  columns = 2,
}: {
  value: T;
  options: { value: T; title: string; hint?: string }[];
  onChange: (value: T) => void;
  name: string;
  columns?: 2 | 3;
}) => (
  <div
    role="radiogroup"
    aria-label={name}
    className={`grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          className={`rounded-lg border px-4 py-3 text-left outline-none transition-fg focus-visible:shadow-borders-focus ${
            active
              ? "border-ui-border-interactive bg-ui-bg-base-pressed"
              : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover"
          }`}
        >
          <Text size="small" weight="plus">
            {option.title}
          </Text>
          {option.hint ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              {option.hint}
            </Text>
          ) : null}
        </button>
      );
    })}
  </div>
);

/** Velké zaškrtávátko s popiskem (20 px políčko, celý řádek klikací). */
export const CheckRow = ({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) => (
  <label className="hover:bg-ui-bg-base-hover -mx-2 flex cursor-pointer items-start gap-x-3 rounded-md px-2 py-2">
    <input
      type="checkbox"
      className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--fg-interactive,#3b82f6)]"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span className="flex flex-col">
      <Text size="small">{label}</Text>
      {hint ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      ) : null}
    </span>
  </label>
);
