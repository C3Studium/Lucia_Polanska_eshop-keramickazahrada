import {
  Badge,
  Button,
  Drawer,
  Input,
  Label,
  Prompt,
  Skeleton,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { formatCzk } from "../lib/workbench";
import {
  type AdminGiftVoucher,
  type GiftVoucherRedemption,
  CheckRow,
  ChoiceCards,
  CopyButton,
  Fact,
  KIND_LABEL,
  StateBadge,
  formatDate,
  formatDateTime,
  formatValidUntil,
  invalidateVouchers,
  looksLikeEmail,
  openVoucherPage,
  pageUrlIsRelative,
  stahnoutPoukazPdf,
  todayInput,
  useVoucherAction,
  validUntilInput,
} from "./gift-voucher-shared";

/**
 * Detail poukazu — všechno o jednom poukazu a tlačítka podle stavu:
 *
 * - nezaplacený: zapsat platbu (hotově / převodem), platební odkaz ComGate,
 * - zaplacený: poslat e-mailem, otevřít / vytisknout, uplatnit,
 * - historie uplatnění s „Vrátit“, úprava údajů, zrušit / obnovit.
 *
 * Formuláře (uplatnit, poslat, upravit) se rozbalují přímo v detailu — žádné
 * další okno přes okno. Potvrzovací dialog jen u zrušení a vrácení.
 */

type Panel = null | "redeem" | "send" | "edit";

export const GiftVoucherDetailDrawer = ({
  voucherId,
  initial,
  paymentUrlHint,
  open,
  onOpenChange,
}: {
  voucherId: string | null;
  /** Řádek ze seznamu — detail se ukáže hned, čerstvá data dorazí za ním. */
  initial?: AdminGiftVoucher;
  /** Platební odkaz z odpovědi na vystavení (než se načte detail). */
  paymentUrlHint?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const query = useQuery<{ gift_voucher: AdminGiftVoucher }>({
    queryKey: ["gift-vouchers", "detail", voucherId],
    queryFn: () => sdk.client.fetch(`/admin/gift-vouchers/${voucherId}`),
    enabled: Boolean(voucherId) && open,
    placeholderData: initial ? { gift_voucher: initial } : undefined,
  });
  const voucher = query.data?.gift_voucher;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Poukaz</Drawer.Title>
          <Drawer.Description>
            {voucher
              ? `Vystaven ${formatDate(voucher.created_at)} · ${KIND_LABEL[voucher.kind]}`
              : "Načítám…"}
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          {voucher ? (
            <VoucherDetail
              key={voucher.id}
              voucher={voucher}
              paymentUrlHint={paymentUrlHint ?? null}
            />
          ) : query.isError ? (
            <Text size="small" className="text-ui-fg-error">
              {ceskaChyba(query.error, "Poukaz se nepodařilo načíst.")}
            </Text>
          ) : (
            <div className="flex flex-col gap-y-3">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Zavřít
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */
/* Obsah detailu                                                       */
/* ------------------------------------------------------------------ */

const Block = ({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) => (
  <section className="flex flex-col gap-y-3">
    <div className="border-ui-border-base flex items-center justify-between gap-x-3 border-b pb-1">
      <Text size="small" weight="plus">
        {title}
      </Text>
      {aside}
    </div>
    {children}
  </section>
);

const VoucherDetail = ({
  voucher,
  paymentUrlHint,
}: {
  voucher: AdminGiftVoucher;
  paymentUrlHint: string | null;
}) => {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);

  const paid = voucher.payment_status === "paid";
  const cancelled = voucher.status === "cancelled";
  const usedAmount = voucher.initial_value - voucher.balance;

  return (
    <div className="flex flex-col gap-y-8">
      {/* Kód, stav, peníze */}
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-2xl font-semibold tracking-wider sm:text-3xl">
            {voucher.code}
          </span>
          <CopyButton value={voucher.code} what="Kód" label="Kopírovat" />
          <StateBadge voucher={voucher} />
          <Badge size="2xsmall" color="grey">
            {KIND_LABEL[voucher.kind]}
          </Badge>
        </div>
        <div className="bg-ui-bg-subtle grid grid-cols-3 gap-3 rounded-lg px-4 py-3">
          <Fact label="Hodnota">{formatCzk(voucher.initial_value)}</Fact>
          <Fact label="Zbývá">
            <span className="txt-large font-semibold">{formatCzk(voucher.balance)}</span>
            {usedAmount > 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                uplatněno {formatCzk(usedAmount)}
              </Text>
            )}
          </Fact>
          <Fact label="Platí do">{formatValidUntil(voucher.valid_until)}</Fact>
        </div>
        <StateExplanation voucher={voucher} />
      </div>

      {/* Co se dá udělat */}
      {voucher.refunded_at ? (
        <RefundedBlock voucher={voucher} />
      ) : cancelled ? (
        <RestoreBlock voucher={voucher} />
      ) : !paid ? (
        <PaymentBlock voucher={voucher} paymentUrlHint={paymentUrlHint} />
      ) : (
        <Block title="Co s poukazem">
          <div className="flex flex-wrap gap-2">
            {voucher.state === "active" && (
              <Button
                variant={panel === "redeem" ? "primary" : "secondary"}
                onClick={() => toggle("redeem")}
              >
                Uplatnit
              </Button>
            )}
            <Button
              variant={panel === "send" ? "primary" : "secondary"}
              onClick={() => toggle("send")}
            >
              Poslat e-mailem
            </Button>
            <PoukazPdfButton voucherId={voucher.id} />
            <Button variant="secondary" onClick={() => openVoucherPage(voucher)}>
              Otevřít stránku poukazu
            </Button>
          </div>
          {pageUrlIsRelative(voucher) && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Pozor: server nezná adresu obchodu, odkaz na poukaz se nemusí
              otevřít. Dejte prosím vědět Matějovi.
            </Text>
          )}
          {panel === "redeem" && (
            <RedeemPanel voucher={voucher} onDone={() => setPanel(null)} />
          )}
          {panel === "send" && <SendPanel voucher={voucher} onDone={() => setPanel(null)} />}
        </Block>
      )}

      <RedemptionHistory voucher={voucher} />

      {/* Údaje */}
      <Block
        title="Údaje"
        aside={
          <button
            type="button"
            className="text-ui-fg-interactive txt-compact-small hover:underline"
            onClick={() => toggle("edit")}
          >
            {panel === "edit" ? "Zavřít úpravy" : "Upravit údaje"}
          </button>
        }
      >
        {panel === "edit" ? (
          <EditPanel voucher={voucher} onDone={() => setPanel(null)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Fact label="Pro koho">
              {voucher.recipient_name || "—"}
              {voucher.recipient_email ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {voucher.recipient_email}
                </Text>
              ) : null}
            </Fact>
            <Fact label="Kupující">
              {voucher.buyer_name}
              {[voucher.buyer_email, voucher.buyer_phone].filter(Boolean).map((contact) => (
                <Text key={contact} size="xsmall" className="text-ui-fg-subtle">
                  {contact}
                </Text>
              ))}
            </Fact>
            {voucher.dedication ? (
              <div className="sm:col-span-2">
                <Fact label="Věnování">
                  <span className="whitespace-pre-line italic">„{voucher.dedication}“</span>
                </Fact>
              </div>
            ) : null}
            <Fact label="Platba">
              {voucher.payment_method_label}
              <Text size="xsmall" className="text-ui-fg-subtle">
                {paid
                  ? `zaplaceno ${formatDateTime(voucher.paid_at)}`
                  : "zatím nezaplaceno"}
              </Text>
            </Fact>
            <Fact label="Odesláno e-mailem">
              {voucher.sent_at ? (
                <>
                  {formatDateTime(voucher.sent_at)}
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    na {voucher.sent_to}
                  </Text>
                </>
              ) : (
                "zatím ne"
              )}
            </Fact>
            {voucher.order_id ? (
              <Fact label="Koupeno objednávkou">{voucher.order_id}</Fact>
            ) : null}
            {voucher.cancelled_at ? (
              <Fact label="Zrušeno">{formatDateTime(voucher.cancelled_at)}</Fact>
            ) : null}
            <div className="sm:col-span-2">
              <Fact label="Interní poznámka">
                <span className="whitespace-pre-line">{voucher.note || "—"}</span>
              </Fact>
            </div>
          </div>
        )}
      </Block>

      {!cancelled && (
        <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          {paid && voucher.payment_method !== "comgate" && voucher.payment_method !== "order" && (
            <UndoPaymentButton voucher={voucher} />
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {paid && <RefundPrompt voucher={voucher} />}
            <CancelPrompt voucher={voucher} />
          </div>
        </div>
      )}
    </div>
  );
};

/** Jedna věta: proč je poukaz v tomhle stavu a co dál. */
const StateExplanation = ({ voucher }: { voucher: AdminGiftVoucher }) => {
  const text: Record<AdminGiftVoucher["state"], string> = {
    pending_payment:
      "Poukaz zatím není zaplacený, takže nejde uplatnit a kód se zákazníkovi neukazuje.",
    active: "Poukaz je zaplacený a dá se uplatnit — v obchodě i u vás v dílně.",
    used: "Celá hodnota poukazu už je uplatněná.",
    expired: `Platnost skončila ${formatValidUntil(voucher.valid_until)}. Když chcete vyjít vstříc, prodlužte ji v „Upravit údaje“.`,
    cancelled: "Poukaz je zrušený — nejde uplatnit ani poslat.",
    refunded: "Za poukaz se vrátily peníze, takže je spotřebovaný — nejde uplatnit, poslat ani obnovit.",
  };
  return (
    <Text size="small" className="text-ui-fg-subtle">
      {text[voucher.state]}
    </Text>
  );
};

/* ------------------------------------------------------------------ */
/* Nezaplacený: platba                                                 */
/* ------------------------------------------------------------------ */

const PaymentBlock = ({
  voucher,
  paymentUrlHint,
}: {
  voucher: AdminGiftVoucher;
  paymentUrlHint: string | null;
}) => {
  const electronic = voucher.kind === "electronic";
  const [sendOnPay, setSendOnPay] = useState(true);
  const [linkFromAction, setLinkFromAction] = useState<string | null>(null);
  const paymentUrl = linkFromAction || voucher.payment_url || paymentUrlHint;
  const sendTo = voucher.recipient_email || voucher.buyer_email;

  const markPaid = useVoucherAction(voucher.id, {
    fallback: "Platbu se nepodařilo zapsat.",
    success: () => "Platba je zapsaná — poukaz platí.",
  });
  const link = useVoucherAction(voucher.id, {
    fallback: "Platební odkaz se nepodařilo vytvořit.",
    success: (outcome) => (outcome.email ? undefined : "Platební odkaz je připravený."),
    onDone: (outcome) => {
      if (outcome.payment_url) setLinkFromAction(outcome.payment_url);
    },
  });

  return (
    <Block title="Čeká na platbu">
      <div className="flex flex-col gap-y-3">
        <Text size="small">Peníze už máte? Zapište, jak přišly:</Text>
        {electronic && (
          <CheckRow
            checked={sendOnPay}
            onChange={setSendOnPay}
            label="Po zapsání poslat poukaz e-mailem"
            hint={
              sendTo
                ? `Odejde na ${sendTo}.`
                : "Poukaz nemá e-mail — doplňte ho v „Upravit údaje“."
            }
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            isLoading={markPaid.isPending && markPaid.variables?.method === "cash"}
            disabled={markPaid.isPending}
            onClick={() =>
              markPaid.mutate({ action: "mark_paid", method: "cash", send: electronic && sendOnPay })
            }
          >
            Zapsat platbu hotově
          </Button>
          <Button
            variant="secondary"
            isLoading={markPaid.isPending && markPaid.variables?.method === "transfer"}
            disabled={markPaid.isPending}
            onClick={() =>
              markPaid.mutate({ action: "mark_paid", method: "transfer", send: electronic && sendOnPay })
            }
          >
            Zapsat platbu převodem
          </Button>
        </div>
      </div>

      <div className="bg-ui-bg-subtle mt-2 flex flex-col gap-y-3 rounded-lg px-4 py-3">
        <Text size="small" weight="plus">
          Platební odkaz (platba kartou online)
        </Text>
        {paymentUrl ? (
          <>
            <div className="flex items-center gap-x-2">
              <Input readOnly value={paymentUrl} onFocus={(event) => event.target.select()} />
              <CopyButton value={paymentUrl} what="Odkaz" label="Kopírovat" />
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Odkaz můžete poslat třeba SMS nebo zprávou. Po zaplacení se platba
              zapíše sama (do pár minut)
              {electronic ? " a poukaz odejde e-mailem." : "."}
            </Text>
          </>
        ) : (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Kupující dostane odkaz, kde zaplatí kartou. Po zaplacení se platba
            zapíše sama{electronic ? " a poukaz mu odejde e-mailem" : ""}.
          </Text>
        )}
        <div className="flex flex-wrap gap-2">
          {/* Starý odkaz mohl v ComGate vypršet — server ho ověří, a když
              neplatí, založí nový. */}
          <Button
            variant="secondary"
            isLoading={link.isPending && !link.variables?.send}
            disabled={link.isPending}
            onClick={() => link.mutate({ action: "payment_link", send: false })}
          >
            {paymentUrl ? "Zkontrolovat / obnovit odkaz" : "Vytvořit platební odkaz"}
          </Button>
          <Button
            variant="secondary"
            isLoading={link.isPending && Boolean(link.variables?.send)}
            disabled={link.isPending || !voucher.buyer_email}
            onClick={() => link.mutate({ action: "payment_link", send: true })}
          >
            {voucher.buyer_email
              ? `Poslat odkaz kupujícímu (${voucher.buyer_email})`
              : "Poslat odkaz kupujícímu"}
          </Button>
        </div>
        {!voucher.buyer_email && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Kupující nemá e-mail — doplňte ho v „Upravit údaje“, nebo odkaz
            zkopírujte a pošlete jinak.
          </Text>
        )}
      </div>
    </Block>
  );
};

/* ------------------------------------------------------------------ */
/* Zaplacený: uplatnit, poslat                                         */
/* ------------------------------------------------------------------ */

/**
 * Vystavit poukaz jako PDF — hotová kartička k vytištění nebo přeposlání.
 * Je to tentýž soubor, který dostane obdarovaný v e-mailu, takže vytištěný
 * poukaz z dílny a ten elektronický vypadají stejně.
 */
export const PoukazPdfButton = ({
  voucherId,
  variant = "secondary",
}: {
  voucherId: string;
  variant?: "primary" | "secondary";
}) => {
  const [vystavuje, setVystavuje] = useState(false);
  return (
    <Button
      variant={variant}
      isLoading={vystavuje}
      onClick={async () => {
        setVystavuje(true);
        await stahnoutPoukazPdf(voucherId);
        setVystavuje(false);
      }}
    >
      Stáhnout poukaz (PDF)
    </Button>
  );
};

const RedeemPanel = ({ voucher, onDone }: { voucher: AdminGiftVoucher; onDone: () => void }) => {
  const [amount, setAmount] = useState("");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const value = Number(amount.replace(/\s/g, "").replace(",", "."));
  const redeem = useVoucherAction(voucher.id, {
    fallback: "Poukaz se nepodařilo uplatnit.",
    success: (outcome) =>
      `Uplatněno ${formatCzk(value)}. Na poukazu zbývá ${formatCzk(outcome.gift_voucher.balance)}.`,
    onDone,
  });

  const problem = !amount.trim()
    ? null
    : !Number.isInteger(value) || value <= 0
      ? "Částku zadejte v celých korunách."
      : value > voucher.balance
        ? `Na poukazu zbývá jen ${formatCzk(voucher.balance)}.`
        : null;

  return (
    <div className="bg-ui-bg-subtle flex flex-col gap-y-4 rounded-lg px-4 py-4">
      <Text size="small">
        Na poukazu zbývá <strong>{formatCzk(voucher.balance)}</strong>. Kolik
        se teď uplatní?
      </Text>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="redeem-amount">Částka v Kč</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="redeem-amount"
            inputMode="numeric"
            value={amount}
            className="max-w-40"
            aria-invalid={Boolean(problem)}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button variant="secondary" size="small" onClick={() => setAmount(String(voucher.balance))}>
            Celý zůstatek
          </Button>
        </div>
        {problem && (
          <Text size="xsmall" className="text-ui-fg-error">
            {problem}
          </Text>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="redeem-order">Číslo objednávky (nepovinné)</Label>
          <Input
            id="redeem-order"
            value={orderId}
            placeholder="např. 1042"
            onChange={(event) => setOrderId(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="redeem-note">Poznámka (nepovinné)</Label>
          <Input
            id="redeem-note"
            value={note}
            placeholder="v dílně — hrnek"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          isLoading={redeem.isPending}
          disabled={!amount.trim() || Boolean(problem)}
          onClick={() =>
            redeem.mutate({
              action: "redeem",
              amount: value,
              order_id: orderId.trim() || null,
              note: note.trim() || null,
            })
          }
        >
          {Number.isInteger(value) && value > 0 && !problem
            ? `Uplatnit ${formatCzk(value)}`
            : "Uplatnit"}
        </Button>
        <Button variant="transparent" onClick={onDone}>
          Zrušit
        </Button>
      </div>
    </div>
  );
};

const SendPanel = ({ voucher, onDone }: { voucher: AdminGiftVoucher; onDone: () => void }) => {
  type Target = "recipient" | "buyer" | "other";
  const options: { value: Target; title: string; hint?: string }[] = [];
  if (voucher.recipient_email)
    options.push({ value: "recipient", title: "Obdarovanému", hint: voucher.recipient_email });
  if (voucher.buyer_email && voucher.buyer_email !== voucher.recipient_email)
    options.push({ value: "buyer", title: "Kupujícímu", hint: voucher.buyer_email });
  options.push({ value: "other", title: "Na jinou adresu" });

  const [target, setTarget] = useState<Target>(options[0].value);
  const [other, setOther] = useState("");
  const to =
    target === "recipient"
      ? voucher.recipient_email
      : target === "buyer"
        ? voucher.buyer_email
        : other.trim();

  const send = useVoucherAction(voucher.id, {
    fallback: "Poukaz se nepodařilo poslat.",
    onDone,
  });

  const otherInvalid = target === "other" && other.trim() !== "" && !looksLikeEmail(other);

  return (
    <div className="bg-ui-bg-subtle flex flex-col gap-y-4 rounded-lg px-4 py-4">
      <Text size="small">Komu poukaz poslat?</Text>
      <ChoiceCards<Target>
        name="Komu poslat"
        value={target}
        onChange={setTarget}
        columns={options.length === 3 ? 3 : 2}
        options={options}
      />
      {target === "other" && (
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="send-other">E-mail</Label>
          <Input
            id="send-other"
            type="email"
            value={other}
            aria-invalid={otherInvalid}
            onChange={(event) => setOther(event.target.value)}
          />
          {otherInvalid && (
            <Text size="xsmall" className="text-ui-fg-error">
              Zkontrolujte prosím e-mail.
            </Text>
          )}
        </div>
      )}
      {voucher.sent_at && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Naposledy odesláno {formatDateTime(voucher.sent_at)} na {voucher.sent_to}.
        </Text>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          isLoading={send.isPending}
          disabled={!to || !looksLikeEmail(to)}
          onClick={() => send.mutate({ action: "send", to })}
        >
          {to && looksLikeEmail(to) ? `Poslat na ${to}` : "Poslat"}
        </Button>
        <Button variant="transparent" onClick={onDone}>
          Zrušit
        </Button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Historie uplatnění                                                  */
/* ------------------------------------------------------------------ */

const RedemptionHistory = ({ voucher }: { voucher: AdminGiftVoucher }) => {
  if (!voucher.redemptions.length) {
    return voucher.payment_status === "paid" ? (
      <Block title="Uplatnění">
        <Text size="small" className="text-ui-fg-subtle">
          Poukaz zatím nikdo neuplatnil.
        </Text>
      </Block>
    ) : null;
  }
  return (
    <Block title="Uplatnění">
      <ul className="divide-ui-border-base flex flex-col divide-y">
        {voucher.redemptions.map((redemption) => (
          <li key={redemption.id} className="flex items-start justify-between gap-x-3 py-2">
            <div className="min-w-0">
              <Text
                size="small"
                weight="plus"
                className={redemption.reversed_at ? "text-ui-fg-muted line-through" : ""}
              >
                {formatCzk(redemption.amount)}
              </Text>
              <Text
                size="xsmall"
                className={redemption.reversed_at ? "text-ui-fg-muted line-through" : "text-ui-fg-subtle"}
              >
                {formatDateTime(redemption.created_at)}
                {redemption.order_id ? ` · objednávka ${redemption.order_id}` : ""}
                {redemption.note ? ` · ${redemption.note}` : ""}
              </Text>
              {redemption.reversed_at && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  vráceno {formatDateTime(redemption.reversed_at)}
                  {redemption.reverse_note ? ` — ${redemption.reverse_note}` : ""}
                </Text>
              )}
            </div>
            {!redemption.reversed_at && voucher.status !== "cancelled" && (
              <ReversePrompt voucher={voucher} redemption={redemption} />
            )}
          </li>
        ))}
      </ul>
    </Block>
  );
};

const ReversePrompt = ({
  voucher,
  redemption,
}: {
  voucher: AdminGiftVoucher;
  redemption: GiftVoucherRedemption;
}) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const reverse = useVoucherAction(voucher.id, {
    fallback: "Uplatnění se nepodařilo vrátit.",
    success: (outcome) =>
      `${formatCzk(redemption.amount)} vráceno na poukaz. Zbývá ${formatCzk(outcome.gift_voucher.balance)}.`,
    onDone: () => {
      setOpen(false);
      setNote("");
    },
  });

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button variant="secondary" size="small">
          Vrátit
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Vrátit {formatCzk(redemption.amount)} na poukaz?</Prompt.Title>
          <Prompt.Description>
            Částka se přičte zpátky k zůstatku poukazu {voucher.code} — třeba
            když zákazník zboží vrátil, nebo se uplatnění zapsalo omylem.
          </Prompt.Description>
        </Prompt.Header>
        <div className="flex flex-col gap-y-2 px-6 pb-4">
          <Label htmlFor={`reverse-note-${redemption.id}`}>Důvod (nepovinné)</Label>
          <Textarea
            id={`reverse-note-${redemption.id}`}
            rows={2}
            value={note}
            placeholder="např. zákazník hrnek vrátil"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Prompt.Footer>
          <Prompt.Cancel>Ponechat</Prompt.Cancel>
          <Prompt.Action
            disabled={reverse.isPending}
            onClick={(event) => {
              // Dialog zavře až úspěch — při chybě zůstane otevřený i s poznámkou.
              event.preventDefault();
              reverse.mutate({
                action: "reverse",
                redemption_id: redemption.id,
                note: note.trim() || null,
              });
            }}
          >
            Vrátit na poukaz
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/* ------------------------------------------------------------------ */
/* Úprava údajů                                                        */
/* ------------------------------------------------------------------ */

const EditPanel = ({ voucher, onDone }: { voucher: AdminGiftVoucher; onDone: () => void }) => {
  const queryClient = useQueryClient();
  const [recipientName, setRecipientName] = useState(voucher.recipient_name ?? "");
  const [recipientEmail, setRecipientEmail] = useState(voucher.recipient_email ?? "");
  const [dedication, setDedication] = useState(voucher.dedication ?? "");
  const [buyerName, setBuyerName] = useState(voucher.buyer_name ?? "");
  const [buyerEmail, setBuyerEmail] = useState(voucher.buyer_email ?? "");
  const [buyerPhone, setBuyerPhone] = useState(voucher.buyer_phone ?? "");
  const [note, setNote] = useState(voucher.note ?? "");
  const [kind, setKind] = useState<AdminGiftVoucher["kind"]>(voucher.kind);
  const originalValid = validUntilInput(voucher.valid_until);
  const [validUntil, setValidUntil] = useState(originalValid);

  const problems: string[] = [];
  if (!buyerName.trim()) problems.push("Jméno kupujícího nesmí zůstat prázdné.");
  if (recipientEmail.trim() && !looksLikeEmail(recipientEmail))
    problems.push("Zkontrolujte e-mail obdarovaného.");
  if (buyerEmail.trim() && !looksLikeEmail(buyerEmail))
    problems.push("Zkontrolujte e-mail kupujícího.");
  if (validUntil !== originalValid && (!validUntil || validUntil <= todayInput()))
    problems.push("Nové datum platnosti musí být po dnešku.");

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ gift_voucher: AdminGiftVoucher }>(`/admin/gift-vouchers/${voucher.id}`, {
        method: "POST",
        body: {
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientEmail.trim() || null,
          dedication: dedication.trim() || null,
          buyer_name: buyerName.trim(),
          buyer_email: buyerEmail.trim() || null,
          buyer_phone: buyerPhone.trim() || null,
          note: note.trim() || null,
          kind,
          ...(validUntil !== originalValid ? { valid_until: validUntil } : {}),
        },
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["gift-vouchers", "detail", voucher.id], result);
      await invalidateVouchers(queryClient);
      toast.success("Údaje poukazu jsou uložené.");
      onDone();
    },
    onError: (error) => toast.error(ceskaChyba(error, "Údaje se nepodařilo uložit.")),
  });

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <Label>Jaký poukaz</Label>
        <ChoiceCards<AdminGiftVoucher["kind"]>
          name="Typ poukazu"
          value={kind}
          onChange={setKind}
          options={[
            { value: "physical", title: "Vytištěný" },
            { value: "electronic", title: "Elektronický" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditField id="edit-recipient" label="Jméno obdarovaného" value={recipientName} onChange={setRecipientName} />
        <EditField
          id="edit-recipient-email"
          label="E-mail obdarovaného"
          type="email"
          value={recipientEmail}
          onChange={setRecipientEmail}
        />
        <EditField id="edit-buyer" label="Jméno kupujícího" value={buyerName} onChange={setBuyerName} />
        <EditField id="edit-buyer-email" label="E-mail kupujícího" type="email" value={buyerEmail} onChange={setBuyerEmail} />
        <EditField id="edit-buyer-phone" label="Telefon kupujícího" type="tel" value={buyerPhone} onChange={setBuyerPhone} />
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="edit-valid">Platí do</Label>
          <Input
            id="edit-valid"
            type="date"
            min={todayInput()}
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Tady se dá platnost prodloužit.
          </Text>
        </div>
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="edit-dedication">Věnování</Label>
        <Textarea id="edit-dedication" rows={3} value={dedication} onChange={(event) => setDedication(event.target.value)} />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="edit-note">Interní poznámka</Label>
        <Textarea id="edit-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {problems.length > 0 && (
        <div className="flex flex-col gap-y-1">
          {problems.map((problem) => (
            <Text key={problem} size="small" className="text-ui-fg-error">
              · {problem}
            </Text>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          isLoading={save.isPending}
          disabled={problems.length > 0}
          onClick={() => save.mutate()}
        >
          Uložit údaje
        </Button>
        <Button variant="transparent" onClick={onDone}>
          Zrušit
        </Button>
      </div>
    </div>
  );
};

const EditField = ({
  id,
  label,
  value,
  onChange,
  type,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) => (
  <div className="flex flex-col gap-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
);

/* ------------------------------------------------------------------ */
/* Zrušit / obnovit / vzít platbu zpět                                 */
/* ------------------------------------------------------------------ */

const CancelPrompt = ({ voucher }: { voucher: AdminGiftVoucher }) => {
  const cancel = useVoucherAction(voucher.id, {
    fallback: "Poukaz se nepodařilo zrušit.",
    success: () => `Poukaz ${voucher.code} je zrušený.`,
  });
  return (
    <Prompt>
      <Prompt.Trigger asChild>
        <Button variant="danger" size="small">
          Zrušit poukaz
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Zrušit poukaz {voucher.code}?</Prompt.Title>
          <Prompt.Description>
            Zrušený poukaz nepůjde uplatnit v obchodě ani v dílně
            {voucher.balance > 0 ? ` (zbývá na něm ${formatCzk(voucher.balance)})` : ""}.
            {voucher.payment_status === "paid"
              ? " Pokud kupujícímu vracíte peníze, vraťte je zvlášť — zrušením se nic nevrací."
              : ""}{" "}
            Kdyby to byl omyl, poukaz jde zase obnovit.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Ponechat</Prompt.Cancel>
          <Prompt.Action disabled={cancel.isPending} onClick={() => cancel.mutate({ action: "cancel" })}>
            Zrušit poukaz
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/**
 * Vrátit peníze za nepoužitý poukaz (odstoupení do 14 dnů, OP čl. XI).
 * Poukaz se tím natrvalo zneplatní — peníze, nebo poukaz, ne obojí.
 */
const RefundPrompt = ({ voucher }: { voucher: AdminGiftVoucher }) => {
  const [note, setNote] = useState("");
  const refund = useVoucherAction(voucher.id, {
    fallback: "Peníze se nepodařilo vrátit.",
    success: () => `Poukaz ${voucher.code} je zneplatněný — peníze vráceny.`,
  });
  const fromOrder = Boolean(voucher.order_line_item_id);
  const spent = voucher.redemptions.some((r) => !r.reversed_at);
  return (
    <Prompt>
      <Prompt.Trigger asChild>
        <Button variant="secondary" size="small" disabled={fromOrder || spent}
          title={fromOrder ? "Koupený v objednávce — peníze vraťte u objednávky (Reklamace a vrácení)." : spent ? "Poukaz už byl uplatněný." : undefined}>
          Vrátit peníze
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Vrátit peníze za poukaz {voucher.code}?</Prompt.Title>
          <Prompt.Description>
            {voucher.payment_method === "comgate"
              ? `${formatCzk(voucher.initial_value)} se vrátí přes ComGate na kartu nebo účet, ze kterého se platilo.`
              : `Zapíše se, že jste ${formatCzk(voucher.initial_value)} vrátila ${voucher.payment_method === "cash" ? "hotově" : "převodem"} — peníze pošlete sama.`}{" "}
            Poukaz se tím natrvalo zneplatní: nepůjde uplatnit ani obnovit.
          </Prompt.Description>
        </Prompt.Header>
        <div className="px-6 pb-2">
          <Input
            placeholder="Důvod (nepovinné), např. odstoupení do 14 dnů"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Prompt.Footer>
          <Prompt.Cancel>Ponechat</Prompt.Cancel>
          <Prompt.Action disabled={refund.isPending} onClick={() => refund.mutate({ action: "refund", note: note.trim() || null })}>
            Vrátit peníze
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

const RefundedBlock = ({ voucher }: { voucher: AdminGiftVoucher }) => (
  <Block title="Peníze vráceny">
    <Text size="small" className="text-ui-fg-subtle">
      {formatDateTime(voucher.refunded_at ?? null)}
      {voucher.refund_note ? ` — ${voucher.refund_note}` : ""}. Poukaz je spotřebovaný a jeho
      kód v obchodě neplatí.
    </Text>
  </Block>
);

const RestoreBlock = ({ voucher }: { voucher: AdminGiftVoucher }) => {
  const restore = useVoucherAction(voucher.id, {
    fallback: "Poukaz se nepodařilo obnovit.",
    success: () => `Poukaz ${voucher.code} je zase v platnosti.`,
  });
  return (
    <Block title="Zrušený poukaz">
      <Text size="small" className="text-ui-fg-subtle">
        Zrušeno {formatDateTime(voucher.cancelled_at)}. Když to byl omyl,
        obnovte ho — bude zase platit se stejným kódem a zůstatkem.
      </Text>
      <div>
        <Button
          variant="secondary"
          isLoading={restore.isPending}
          onClick={() => restore.mutate({ action: "restore" })}
        >
          Obnovit poukaz
        </Button>
      </div>
    </Block>
  );
};

/** Oprava překliku: platba zapsaná omylem (jen hotově / převodem, před uplatněním). */
const UndoPaymentButton = ({ voucher }: { voucher: AdminGiftVoucher }) => {
  const hasRedemptions = voucher.redemptions.some((r) => !r.reversed_at);
  const unpaid = useVoucherAction(voucher.id, {
    fallback: "Platbu se nepodařilo vzít zpět.",
    success: () => "Platba je vzatá zpět — poukaz zase čeká na platbu.",
  });
  if (hasRedemptions) return null;
  return (
    <button
      type="button"
      className="text-ui-fg-subtle txt-compact-small hover:text-ui-fg-base hover:underline disabled:opacity-50"
      disabled={unpaid.isPending}
      onClick={() => unpaid.mutate({ action: "mark_unpaid" })}
    >
      Platba zapsaná omylem? Vzít zpět
    </button>
  );
};
