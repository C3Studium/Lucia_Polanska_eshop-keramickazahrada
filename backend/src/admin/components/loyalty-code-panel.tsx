import {
  Badge,
  Button,
  Drawer,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Slevový kód pro stálého zákazníka — ruční odeslání z karty zákazníka
 * a nastavení automatu („Kód pro stálé zákazníky").
 *
 * Server dělá všechno podstatné (`lib/loyalty-code.ts`): kód jen pro tohoto
 * člověka, jedno použití, jen potvrzeným odběratelům newsletteru. Tady je jen
 * formulář, náhled skutečného e-mailu a potvrzení — odeslaný e-mail vzít
 * zpět nejde, proto se ptá (confirm-dialog).
 */

export type LoyaltySettings = {
  auto_enabled: boolean;
  after_orders: number;
  percentage: number;
  valid_days: number;
};

/** Stejné hodnoty jako LOYALTY_CODE_DEFAULTS na serveru (lib/loyalty-code-rules.ts). */
export const LOYALTY_DEFAULTS: LoyaltySettings = {
  auto_enabled: false,
  after_orders: 3,
  percentage: 10,
  valid_days: 60,
};

const LIMITS = {
  percentage: [1, 50],
  valid_days: [1, 365],
  after_orders: [2, 50],
} as const;

const inRange = (value: string, [min, max]: readonly [number, number]) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= min && numeric <= max;
};

/** Nastavení z `/admin/merchant-settings`; starší server ho nezná → výchozí. */
export const useLoyaltySettings = () =>
  useQuery<LoyaltySettings>({
    queryKey: ["loyalty-code-settings"],
    queryFn: async () => {
      const response = await sdk.client.fetch<{ settings: Record<string, unknown> }>(
        "/admin/merchant-settings"
      );
      const stored = response.settings?.loyalty_code as Partial<LoyaltySettings> | undefined;
      return { ...LOYALTY_DEFAULTS, ...(stored ?? {}) };
    },
    staleTime: 60_000,
  });

type PreviewResponse = {
  html: string;
  subject: string;
  locale_label: string;
  to: string | null;
  blocked_reason: string | null;
};

export const LoyaltyCodePanel = ({
  customerId,
  customerName,
  blockedReason,
  onClose,
}: {
  customerId: string;
  customerName: string;
  /** Proč poslat nejde (neodebírá newsletter…) — tlačítko se pak vypne. */
  blockedReason?: string | null;
  onClose?: () => void;
}) => {
  const queryClient = useQueryClient();
  const { data: settings } = useLoyaltySettings();
  const [percentage, setPercentage] = useState("");
  const [validDays, setValidDays] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [sent, setSent] = useState<{ code: string; to: string } | null>(null);

  // Výchozí hodnoty z nastavení, jakmile dorazí (a jen dokud nic nepsala).
  useEffect(() => {
    if (!settings) return;
    setPercentage((current) => current || String(settings.percentage));
    setValidDays((current) => current || String(settings.valid_days));
  }, [settings]);

  const valid = inRange(percentage, LIMITS.percentage) && inRange(validDays, LIMITS.valid_days);
  const body = { percentage: Number(percentage), valid_days: Number(validDays) };

  const loadPreview = useMutation({
    mutationFn: () =>
      sdk.client.fetch<PreviewResponse>(
        `/admin/workbench/customers/${customerId}/loyalty-code/preview`,
        { method: "POST", body }
      ),
    onSuccess: (result) => setPreview(result),
    onError: (error) => toast.error(ceskaChyba(error, "Náhled se nepodařilo načíst.")),
  });

  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ code: string; sent_to: string }>(
        `/admin/workbench/customers/${customerId}/loyalty-code`,
        { method: "POST", body }
      ),
    onSuccess: async (result) => {
      setSent({ code: result.code, to: result.sent_to });
      toast.success(`Kód ${result.code} odeslán na ${result.sent_to}.`);
      await queryClient.invalidateQueries({ queryKey: ["workbench-customer-full", customerId] });
    },
    onError: (error) => toast.error(ceskaChyba(error, "Kód se nepodařilo odeslat.")),
  });

  const blocked = blockedReason || preview?.blocked_reason || null;

  if (sent) {
    return (
      <div className="border-ui-border-base bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg border p-4">
        <Text size="small" weight="plus">
          Odesláno — kód {sent.code}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          E-mail odešel na {sent.to}. Kód platí jednou a jen pro tohoto zákazníka.
        </Text>
        {onClose && (
          <Button size="small" variant="secondary" className="self-start" onClick={onClose}>
            Hotovo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border-ui-border-base flex flex-col gap-y-3 rounded-lg border p-4">
      <div>
        <Text size="small" weight="plus">
          Poslat slevový kód
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          Vytvoří kód jen pro tohoto zákazníka, na jeden nákup, a pošle mu ho e-mailem.
          Neplatí na poštovné, balné, poukazy a kusy, které už jsou ve slevě.
        </Text>
      </div>

      {blocked && (
        <Text size="xsmall" className="text-ui-fg-error">
          {blocked}
        </Text>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <Label size="xsmall" htmlFor={`loyalty-pct-${customerId}`}>
            Sleva %
          </Label>
          <Input
            id={`loyalty-pct-${customerId}`}
            size="small"
            type="number"
            min={LIMITS.percentage[0]}
            max={LIMITS.percentage[1]}
            value={percentage}
            onChange={(event) => {
              setPercentage(event.target.value);
              setPreview(null);
            }}
          />
        </div>
        <div className="w-28">
          <Label size="xsmall" htmlFor={`loyalty-days-${customerId}`}>
            Platí dní
          </Label>
          <Input
            id={`loyalty-days-${customerId}`}
            size="small"
            type="number"
            min={LIMITS.valid_days[0]}
            max={LIMITS.valid_days[1]}
            value={validDays}
            onChange={(event) => {
              setValidDays(event.target.value);
              setPreview(null);
            }}
          />
        </div>
      </div>
      {!valid && (
        <Text size="xsmall" className="text-ui-fg-error">
          Sleva 1–50 %, platnost 1–365 dní (celá čísla).
        </Text>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="secondary"
          disabled={!valid}
          isLoading={loadPreview.isPending}
          onClick={() => loadPreview.mutate()}
        >
          {preview ? "Obnovit náhled" : "Náhled e-mailu"}
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="small" disabled={!valid || Boolean(blocked)} isLoading={send.isPending}>
              Vytvořit a odeslat
            </Button>
          }
          title={`Poslat slevový kód — ${customerName}?`}
          description={`Sleva ${percentage} %, platí ${validDays} dní, na jeden nákup.`}
          consequence="E-mail s kódem odejde hned a vzít zpět nejde."
          confirmLabel="Poslat kód"
          destructive={false}
          isPending={send.isPending}
          onConfirm={() => send.mutate()}
        />
        {onClose && (
          <Button size="small" variant="transparent" onClick={onClose}>
            Zavřít
          </Button>
        )}
      </div>

      {preview && (
        <div className="flex flex-col gap-y-2">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Předmět: <span className="text-ui-fg-base">{preview.subject}</span>
            {preview.to ? ` · komu: ${preview.to}` : ""} · e-mail půjde {preview.locale_label}.
            Kód v náhledu je jen ukázka — skutečný vznikne až odesláním.
          </Text>
          <iframe
            title="Náhled e-mailu se slevovým kódem"
            srcDoc={preview.html}
            sandbox=""
            className="border-ui-border-base h-[520px] w-full rounded-lg border bg-white"
          />
        </div>
      )}
    </div>
  );
};

/**
 * „Kód pro stálé zákazníky" — výchozí sleva a platnost + automat po N.
 * zaplacené objednávce. Vzácné nastavení, proto ve vlastním okně, ne na
 * stránce.
 */
export const LoyaltySettingsButton = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useLoyaltySettings();
  const [open, setOpen] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [afterOrders, setAfterOrders] = useState("3");
  const [percentage, setPercentage] = useState("10");
  const [validDays, setValidDays] = useState("60");

  useEffect(() => {
    if (!open || !settings) return;
    setAutoEnabled(settings.auto_enabled);
    setAfterOrders(String(settings.after_orders));
    setPercentage(String(settings.percentage));
    setValidDays(String(settings.valid_days));
  }, [open, settings]);

  const valid =
    inRange(afterOrders, LIMITS.after_orders) &&
    inRange(percentage, LIMITS.percentage) &&
    inRange(validDays, LIMITS.valid_days);

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: {
          loyalty_code: {
            auto_enabled: autoEnabled,
            after_orders: Number(afterOrders),
            percentage: Number(percentage),
            valid_days: Number(validDays),
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyalty-code-settings"] });
      toast.success("Nastavení slevového kódu uloženo.");
      setOpen(false);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Nastavení se nepodařilo uložit.")),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">
          Kód pro stálé zákazníky
          {settings?.auto_enabled ? (
            <Badge size="2xsmall" color="green">
              automaticky
            </Badge>
          ) : null}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Kód pro stálé zákazníky</Drawer.Title>
          <Drawer.Description>
            Jednorázový slevový kód jen pro jednoho zákazníka — ručně z karty zákazníka, nebo
            automaticky po zaplacené objednávce.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Label size="xsmall" htmlFor="loyalty-settings-pct">
                Sleva %
              </Label>
              <Input
                id="loyalty-settings-pct"
                size="small"
                type="number"
                min={LIMITS.percentage[0]}
                max={LIMITS.percentage[1]}
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
              />
            </div>
            <div className="w-32">
              <Label size="xsmall" htmlFor="loyalty-settings-days">
                Platí dní
              </Label>
              <Input
                id="loyalty-settings-days"
                size="small"
                type="number"
                min={LIMITS.valid_days[0]}
                max={LIMITS.valid_days[1]}
                value={validDays}
                onChange={(event) => setValidDays(event.target.value)}
              />
            </div>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle -mt-3">
            Tyto hodnoty se předvyplní i při ručním posílání (tam je jde pokaždé změnit).
          </Text>

          <div className="border-ui-border-base flex flex-col gap-y-3 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Switch
                id="loyalty-settings-auto"
                checked={autoEnabled}
                onCheckedChange={setAutoEnabled}
              />
              <div>
                <Label size="small" weight="plus" htmlFor="loyalty-settings-auto">
                  Posílat kód automaticky
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  Po zaplacení objednávky, kterou zákazník dosáhne zvoleného počtu zaplacených
                  objednávek. Každý zákazník ho dostane jen jednou.
                </Text>
              </div>
            </div>
            <div className="w-64 max-w-full">
              <Label size="xsmall" htmlFor="loyalty-settings-after">
                Po kolikáté zaplacené objednávce
              </Label>
              <Input
                id="loyalty-settings-after"
                size="small"
                type="number"
                min={LIMITS.after_orders[0]}
                max={LIMITS.after_orders[1]}
                value={afterOrders}
                disabled={!autoEnabled}
                onChange={(event) => setAfterOrders(event.target.value)}
              />
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Kód dostane jen zákazník s účtem, který odebírá newsletter (je to obchodní
              sdělení). Ve zkušebním režimu obchodu se nic neposílá. Kdo už teď má víc
              objednávek, dostane kód u své příští zaplacené objednávky.
            </Text>
          </div>

          {!valid && (
            <Text size="xsmall" className="text-ui-fg-error">
              Sleva 1–50 %, platnost 1–365 dní, počet objednávek 2–50 (celá čísla).
            </Text>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Zrušit
            </Button>
          </Drawer.Close>
          <Button size="small" disabled={!valid} isLoading={save.isPending} onClick={() => save.mutate()}>
            Uložit
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
