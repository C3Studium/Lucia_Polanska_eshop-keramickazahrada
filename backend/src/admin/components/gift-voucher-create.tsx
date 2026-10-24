import { Button, Drawer, Input, Label, Text, Textarea, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { formatCzk } from "../lib/workbench";
import {
  ChoiceCards,
  CheckRow,
  type GiftVoucherOutcome,
  VOUCHER_LIMITS,
  announceOutcome,
  invalidateVouchers,
  looksLikeEmail,
  monthsFromTodayInput,
  todayInput,
} from "./gift-voucher-shared";

/**
 * Nový poukaz — prodaný v dílně, po telefonu nebo na objednávku e-mailem.
 *
 * Platnost je předvyplněná na 12 měsíců. Dokud ji Lucie nezmění, server
 * použije „Platnost poukazu“ z Právních údajů (to je ta, kterou slibují
 * obchodní podmínky); změněné datum se pošle tak, jak je.
 */

type Kind = "physical" | "electronic";
type Payment = "cash" | "transfer" | "comgate";

const QUICK_VALUES = [500, 1000, 1500, 2000];
const DEFAULT_MONTHS = 12;

const Field = ({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-y-2">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint ? (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {hint}
      </Text>
    ) : null}
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-y-4">
    <Text size="small" weight="plus" className="text-ui-fg-base border-ui-border-base border-b pb-1">
      {title}
    </Text>
    {children}
  </section>
);

export const GiftVoucherCreateDrawer = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Poukaz vznikl — stránka otevře jeho detail. */
  onCreated: (outcome: GiftVoucherOutcome) => void;
}) => {
  const queryClient = useQueryClient();
  const defaultValid = monthsFromTodayInput(DEFAULT_MONTHS);

  const [kind, setKind] = useState<Kind>("physical");
  const [value, setValue] = useState("1000");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dedication, setDedication] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [payment, setPayment] = useState<Payment>("cash");
  const [validUntil, setValidUntil] = useState(defaultValid);
  const [note, setNote] = useState("");
  const [send, setSend] = useState(true);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const reset = () => {
    setKind("physical");
    setValue("1000");
    setRecipientName("");
    setRecipientEmail("");
    setDedication("");
    setBuyerName("");
    setBuyerEmail("");
    setBuyerPhone("");
    setPayment("cash");
    setValidUntil(monthsFromTodayInput(DEFAULT_MONTHS));
    setNote("");
    setSend(true);
    setTriedSubmit(false);
  };

  const amount = Number(value.replace(/\s/g, "").replace(",", "."));
  const recipientMail = kind === "electronic" ? recipientEmail.trim() : "";
  const buyerMail = buyerEmail.trim();

  const problems: string[] = [];
  if (!Number.isInteger(amount) || amount < VOUCHER_LIMITS.min || amount > VOUCHER_LIMITS.max)
    problems.push(
      `Hodnota poukazu musí být celá částka od ${formatCzk(VOUCHER_LIMITS.min)} do ${formatCzk(VOUCHER_LIMITS.max)}.`
    );
  if (!buyerName.trim()) problems.push("Vyplňte jméno kupujícího.");
  if (recipientMail && !looksLikeEmail(recipientMail))
    problems.push("Zkontrolujte e-mail obdarovaného.");
  if (buyerMail && !looksLikeEmail(buyerMail)) problems.push("Zkontrolujte e-mail kupujícího.");
  if (payment === "comgate" && !buyerMail)
    problems.push("Pro platební odkaz vyplňte e-mail kupujícího — odkaz se posílá na něj.");
  if (kind === "electronic" && !recipientMail && !buyerMail)
    problems.push("Elektronický poukaz potřebuje e-mail obdarovaného nebo kupujícího.");
  if (!validUntil) problems.push("Vyplňte, do kdy poukaz platí.");
  else if (validUntil <= todayInput()) problems.push("Platnost musí skončit až po dnešku.");

  /** Co se po vystavení pošle — a jestli vůbec něco. */
  const sendText = (() => {
    if (payment === "comgate")
      return {
        label: "Hned poslat platební odkaz e-mailem",
        hint: buyerMail
          ? `Kupující dostane odkaz na ${buyerMail}. Po zaplacení ${kind === "electronic" ? "mu poukaz přijde sám" : "uvidíte platbu v detailu"}.`
          : "Odkaz půjde na e-mail kupujícího.",
      };
    if (kind === "electronic") {
      const to = recipientMail || buyerMail;
      return {
        label: "Hned poslat poukaz e-mailem",
        hint: to
          ? `Poukaz odejde ${recipientMail ? "obdarovanému" : "kupujícímu"} na ${to}.`
          : "Poukaz odejde obdarovanému, a když jeho e-mail nevyplníte, kupujícímu.",
      };
    }
    return null;
  })();

  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch<GiftVoucherOutcome>("/admin/gift-vouchers", {
        method: "POST",
        body: {
          kind,
          value: amount,
          // Nezměněné datum = podle Právních údajů (server dopočítá).
          ...(validUntil !== defaultValid ? { valid_until: validUntil } : {}),
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientMail || null,
          dedication: dedication.trim() || null,
          buyer_name: buyerName.trim(),
          buyer_email: buyerMail || null,
          buyer_phone: buyerPhone.trim() || null,
          note: note.trim() || null,
          payment,
          ...(payment !== "comgate" ? { paid: true } : {}),
          send: sendText ? send : false,
        },
      }),
    onSuccess: async (outcome) => {
      await invalidateVouchers(queryClient);
      announceOutcome(outcome, `Poukaz ${outcome.gift_voucher.code} je vystavený.`);
      reset();
      onCreated(outcome);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Poukaz se nepodařilo vystavit.")),
  });

  const submit = () => {
    setTriedSubmit(true);
    if (problems.length) return;
    create.mutate();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Nový poukaz</Drawer.Title>
          <Drawer.Description>
            Poukaz prodaný v dílně, po telefonu nebo domluvený e-mailem. Kód se
            vytvoří sám.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-8">
            <Section title="Poukaz">
              <Field label="Jaký poukaz">
                <ChoiceCards<Kind>
                  name="Typ poukazu"
                  value={kind}
                  onChange={setKind}
                  options={[
                    {
                      value: "physical",
                      title: "Vytištěný",
                      hint: "Vytisknu ho a pošlu poštou nebo předám v dílně.",
                    },
                    {
                      value: "electronic",
                      title: "Elektronický",
                      hint: "Pošlu ho e-mailem.",
                    },
                  ]}
                />
              </Field>

              <Field id="voucher-value" label="Hodnota">
                <div className="flex flex-wrap gap-2">
                  {QUICK_VALUES.map((quick) => (
                    <Button
                      key={quick}
                      type="button"
                      size="base"
                      variant={amount === quick ? "primary" : "secondary"}
                      onClick={() => setValue(String(quick))}
                    >
                      {formatCzk(quick)}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-x-2">
                  <Input
                    id="voucher-value"
                    inputMode="numeric"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="max-w-40"
                  />
                  <Text size="small" className="text-ui-fg-subtle">
                    Kč — nebo napište vlastní částku
                  </Text>
                </div>
              </Field>

              <Field
                id="voucher-valid"
                label="Platí do"
                hint="Předvyplněno na 12 měsíců ode dneška. Můžete změnit."
              >
                <Input
                  id="voucher-valid"
                  type="date"
                  min={todayInput()}
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                  className="max-w-52"
                />
              </Field>
            </Section>

            <Section title="Pro koho">
              <Field id="voucher-recipient" label="Jméno obdarovaného (nepovinné)">
                <Input
                  id="voucher-recipient"
                  value={recipientName}
                  placeholder="např. Jana Nováková"
                  onChange={(event) => setRecipientName(event.target.value)}
                />
              </Field>
              {kind === "electronic" && (
                <Field
                  id="voucher-recipient-email"
                  label="E-mail obdarovaného (nepovinné)"
                  hint="Když ho nevyplníte, poukaz dostane kupující."
                >
                  <Input
                    id="voucher-recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                  />
                </Field>
              )}
              <Field
                id="voucher-dedication"
                label="Věnování (nepovinné)"
                hint="Vytiskne se na poukaz a objeví se v e-mailu."
              >
                <Textarea
                  id="voucher-dedication"
                  rows={3}
                  value={dedication}
                  placeholder="Všechno nejlepší k narozeninám!"
                  onChange={(event) => setDedication(event.target.value)}
                />
              </Field>
            </Section>

            <Section title="Kupující">
              <Field id="voucher-buyer" label="Jméno">
                <Input
                  id="voucher-buyer"
                  value={buyerName}
                  aria-invalid={triedSubmit && !buyerName.trim()}
                  onChange={(event) => setBuyerName(event.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="voucher-buyer-email"
                  label={payment === "comgate" ? "E-mail" : "E-mail (nepovinné)"}
                >
                  <Input
                    id="voucher-buyer-email"
                    type="email"
                    value={buyerEmail}
                    aria-invalid={triedSubmit && payment === "comgate" && !buyerMail}
                    onChange={(event) => setBuyerEmail(event.target.value)}
                  />
                </Field>
                <Field id="voucher-buyer-phone" label="Telefon (nepovinné)">
                  <Input
                    id="voucher-buyer-phone"
                    type="tel"
                    value={buyerPhone}
                    onChange={(event) => setBuyerPhone(event.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Platba">
              <ChoiceCards<Payment>
                name="Platba"
                columns={3}
                value={payment}
                onChange={setPayment}
                options={[
                  { value: "cash", title: "Zaplaceno hotově", hint: "Peníze už mám." },
                  { value: "transfer", title: "Zaplaceno převodem", hint: "Peníze přišly na účet." },
                  {
                    value: "comgate",
                    title: "Pošlu platební odkaz",
                    hint: "Kupující zaplatí kartou online (ComGate).",
                  },
                ]}
              />
              {sendText ? (
                <CheckRow
                  checked={send}
                  onChange={setSend}
                  label={sendText.label}
                  hint={sendText.hint}
                />
              ) : (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Vytištěný poukaz po vystavení otevřete v detailu tlačítkem
                  „Otevřít / vytisknout poukaz“.
                </Text>
              )}
            </Section>

            <Section title="Pro vás">
              <Field
                id="voucher-note"
                label="Interní poznámka (nepovinné)"
                hint="Vidíte ji jen vy, zákazník ne."
              >
                <Textarea
                  id="voucher-note"
                  rows={2}
                  value={note}
                  placeholder="např. vyzvedne si v sobotu"
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </Section>

            {triedSubmit && problems.length > 0 && (
              <div className="bg-ui-bg-subtle flex flex-col gap-y-1 rounded-lg px-4 py-3">
                {problems.map((problem) => (
                  <Text key={problem} size="small" className="text-ui-fg-error">
                    · {problem}
                  </Text>
                ))}
              </div>
            )}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Zavřít
          </Button>
          <Button variant="primary" isLoading={create.isPending} onClick={submit}>
            Vystavit poukaz{Number.isInteger(amount) && amount > 0 ? ` na ${formatCzk(amount)}` : ""}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
