import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { Button, Checkbox, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui";
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client";
import { ceskaChyba } from "../lib/ceska-chyba";

/**
 * Zpoždění objednávky — u KAŽDÉ objednávky (`lib/order-delay.ts`).
 *
 * Lucie zaškrtne výrobky, které je potřeba dodělat a kvůli kterým se
 * objednávka zdrží, zadá nový termín a případně důvod. Zákazník dostane
 * jeden e-mail „Omlouvám se, objednávka se zdrží" se seznamem těch výrobků.
 * Zakázkám mezi zaškrtnutými se posune i termín dokončení.
 */

type DelayEntry = {
  announced_at: string;
  new_date: string;
  previous_date: string | null;
  reason: string | null;
  items: Array<{ id: string; title: string; quantity: number }>;
  emailed_to: string | null;
};

const czDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
};

/** Balné / doběrečné nejsou zboží (lib/packaging-lines.ts — značka a žádný produkt). */
const isServiceLine = (item: any) =>
  !item?.product_id && !item?.variant_id && Boolean(item?.metadata?.packaging_fee || item?.metadata?.dobirka_fee);

const todayIso = () => new Date().toISOString().slice(0, 10);

const Inner = ({ order }: { order: AdminOrder }) => {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  /*
   * Kolik kusů se z řádku zdrží (id → počet). U „3 ks" se často dodělává
   * jen jeden a zákazník má vědět, že zbylé dva přijdou podle plánu
   * (31. 10. 2026). Co tu není, znamená celý řádek.
   */
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const history = useQuery<{ delays: DelayEntry[] }>({
    queryKey: ["order-delays", order.id],
    queryFn: () => sdk.client.fetch(`/admin/orders/${order.id}/delay`),
  });

  const goods = useMemo(
    () => ((order as any).items ?? []).filter((item: any) => !isServiceLine(item)),
    [order]
  );

  const announce = useMutation<{ commissionsMoved: number; emailed: boolean }, Error>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/orders/${order.id}/delay`, {
        method: "POST",
        body: {
          item_ids: selected,
          item_quantities: Object.fromEntries(
            selected
              .map((id) => [id, counts[id]])
              .filter(([, count]) => Number(count) > 0)
          ),
          new_date: date,
          reason: reason.trim() || null,
        },
      }),
    onSuccess: async (result) => {
      toast.success(
        [
          result.emailed ? "Zákazník dostal e-mail s novým termínem." : "Zpoždění je zapsané (objednávka nemá e-mail).",
          result.commissionsMoved ? `Termín zakázky posunut (${result.commissionsMoved}).` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setOpen(false);
      setSelected([]);
      setCounts({});
      setDate("");
      setReason("");
      await cache.invalidateQueries({ queryKey: ["order-delays", order.id] });
      await cache.invalidateQueries({ queryKey: ["made-to-order-order"] });
    },
    onError: (error) => toast.error(ceskaChyba(error, "Zpoždění se nepodařilo oznámit.")),
  });

  if ((order as any).status === "canceled") return null;

  const delays = history.data?.delays ?? [];
  const last = delays[delays.length - 1];
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const canSubmit = selected.length > 0 && Boolean(date) && !announce.isPending;

  return (
    <Container className="flex flex-col gap-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <Heading level="h2">Zpoždění</Heading>
        {!open && (
          <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
            Oznámit zpoždění
          </Button>
        )}
      </div>

      {last ? (
        <Text size="small" className="text-ui-fg-subtle">
          Naposledy {formatDateTime(last.announced_at)}: nový termín <b>{czDate(last.new_date)}</b>
          {last.items.length ? ` — ${last.items.map((i) => i.title).join(", ")}` : ""}.
          {last.emailed_to ? ` E-mail odešel na ${last.emailed_to}.` : " E-mail neodešel (bez adresy)."}
          {delays.length > 1 ? ` Celkem oznámeno ${delays.length}×.` : ""}
        </Text>
      ) : !open ? (
        <Text size="small" className="text-ui-fg-subtle">
          Když se objednávka zdrží, vyberte, které výrobky ještě dodělávate, a zákazník dostane omluvu s novým termínem.
        </Text>
      ) : null}

      {open && (
        <form
          className="flex flex-col gap-y-4 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) announce.mutate();
          }}
        >
          <div className="flex flex-col gap-y-2">
            <Text size="small" weight="plus">Které výrobky je potřeba dodělat?</Text>
            {goods.map((item: any) => {
              const naRadku = Math.max(1, Math.round(Number(item.quantity) || 1));
              const vybrano = selected.includes(item.id);
              const kolik = Math.min(naRadku, Math.max(1, counts[item.id] ?? naRadku));
              return (
                <div key={item.id} className="flex flex-col gap-y-1">
                  <label className="flex cursor-pointer items-start gap-x-2">
                    <Checkbox
                      checked={vybrano}
                      onCheckedChange={() => toggle(item.id)}
                      className="mt-0.5"
                    />
                    <span className="txt-small">
                      {item.title}
                      {item.variant_title && item.variant_title !== "Default variant" ? ` — ${item.variant_title}` : ""}
                      {naRadku > 1 ? ` · ${naRadku} ks` : ""}
                      {item.metadata?.made_to_order ? (
                        <span className="text-ui-fg-subtle"> (zakázka — posune se i termín výroby)</span>
                      ) : null}
                    </span>
                  </label>

                  {/* Kolik kusů z řádku se dodělává — jen tam, kde je z čeho
                      vybírat, a jen u zaškrtnutého řádku. */}
                  {vybrano && naRadku > 1 && (
                    <div className="ml-6 flex items-center gap-x-2">
                      <Label size="xsmall" htmlFor={`delay-qty-${item.id}`}>
                        Čeká se na
                      </Label>
                      <Input
                        id={`delay-qty-${item.id}`}
                        type="number"
                        min={1}
                        max={naRadku}
                        className="w-20"
                        value={String(kolik)}
                        onChange={(event) =>
                          setCounts((current) => ({
                            ...current,
                            [item.id]: Math.min(
                              naRadku,
                              Math.max(1, Math.round(Number(event.target.value) || 1))
                            ),
                          }))
                        }
                      />
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        z {naRadku} ks
                        {kolik < naRadku
                          ? ` — zbylé ${naRadku - kolik} ks pošlete podle plánu`
                          : ""}
                      </Text>
                    </div>
                  )}
                </div>
              );
            })}
            {goods.length > 1 && (
              <button
                type="button"
                className="text-ui-fg-interactive txt-compact-small self-start hover:underline"
                onClick={() => setSelected(selected.length === goods.length ? [] : goods.map((i: any) => i.id))}
              >
                {selected.length === goods.length ? "Zrušit výběr" : "Vybrat všechny"}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-y-1">
            <Label size="xsmall" htmlFor={`delay-date-${order.id}`}>Nový termín (kdy objednávku pošlete / předáte)</Label>
            <Input
              id={`delay-date-${order.id}`}
              type="date"
              min={todayIso()}
              className="w-44"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <Label size="xsmall" htmlFor={`delay-reason-${order.id}`}>Důvod (nepovinné — zákazník ho uvidí)</Label>
            <Textarea
              id={`delay-reason-${order.id}`}
              rows={2}
              placeholder="Např. glazura potřebuje ještě jeden výpal"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <div className="flex justify-end gap-x-2">
            <Button type="button" size="small" variant="secondary" onClick={() => setOpen(false)}>
              Zpět
            </Button>
            <Button type="submit" size="small" disabled={!canSubmit} isLoading={announce.isPending}>
              Poslat zákazníkovi omluvu
            </Button>
          </div>
        </form>
      )}
    </Container>
  );
};

const OrderDelayWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={adminQueryClient}>
    <Inner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
});

export default OrderDelayWidget;
