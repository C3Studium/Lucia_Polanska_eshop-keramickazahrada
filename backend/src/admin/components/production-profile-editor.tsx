import {
  Button,
  Drawer,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * The commission terms of one product — Produkty+ (P8-3, finally).
 *
 * This is where the owner sets **the slider floor**: the minimum a customer
 * can choose to pay at checkout. Everything the storefront enforces about
 * commission money starts from the numbers on this form, which is why it
 * lives on the catalog workbench and not in a module page nobody opens.
 *
 * The form PATCHes the full payload — the route's semantics — so every field
 * is loaded before anything is shown, and saving without touching a field
 * writes back what was already true.
 */

type ProfileForm = {
  enabled: boolean;
  default_deposit_percentage: string;
  allow_full_prepayment: boolean;
  production_time_min_days: string;
  production_time_max_days: string;
  specification_required: boolean;
  specification_prompt: string;
  contact_customer_after_order: boolean;
  allow_final_price_adjustment: boolean;
};

const toForm = (profile: any): ProfileForm => ({
  enabled: profile?.enabled ?? false,
  default_deposit_percentage: String(
    profile?.default_deposit_percentage ?? 25
  ),
  allow_full_prepayment: profile?.allow_full_prepayment !== false,
  production_time_min_days: String(profile?.production_time_min_days ?? 14),
  production_time_max_days: String(profile?.production_time_max_days ?? 42),
  specification_required: profile?.specification_required ?? true,
  specification_prompt: profile?.specification_prompt ?? "",
  contact_customer_after_order:
    profile?.contact_customer_after_order ?? true,
  allow_final_price_adjustment:
    profile?.allow_final_price_adjustment ?? true,
});

export const ProductionProfileEditor = ({
  productId,
  productTitle,
  trigger,
  onSaved,
}: {
  productId: string;
  productTitle: string;
  trigger: React.ReactNode;
  onSaved?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ product: any }>({
    queryKey: ["production-profile", productId],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/products/${productId}`),
    enabled: open,
  });

  useEffect(() => {
    if (open && data) {
      setForm(toForm(data.product?.profile));
    }
  }, [open, data]);

  const save = useMutation({
    mutationFn: (payload: ProfileForm) => {
      const floor = Number(payload.default_deposit_percentage);
      const minDays = Number(payload.production_time_min_days);
      const maxDays = Number(payload.production_time_max_days);

      // The one rule, enforced before the request leaves the browser too:
      // a floor of zero would be „pay later" wearing a percent sign.
      if (!Number.isFinite(floor) || floor < 1 || floor > 100) {
        throw new Error("Záloha musí být mezi 1 a 100 %.");
      }
      if (
        !Number.isFinite(minDays) ||
        !Number.isFinite(maxDays) ||
        minDays < 1 ||
        maxDays < minDays
      ) {
        throw new Error(
          "Doba výroby musí být kladná a spodní hranice nesmí být větší než horní."
        );
      }

      return sdk.client.fetch(
        `/admin/made-to-order/products/${productId}`,
        {
          method: "PATCH",
          body: {
            enabled: payload.enabled,
            default_deposit_percentage: floor,
            allow_full_prepayment: payload.allow_full_prepayment,
            production_time_min_days: minDays,
            production_time_max_days: maxDays,
            specification_required: payload.specification_required,
            specification_prompt:
              payload.specification_prompt.trim() || null,
            contact_customer_after_order:
              payload.contact_customer_after_order,
            allow_final_price_adjustment:
              payload.allow_final_price_adjustment,
          },
        }
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workbench-products"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["production-profile", productId],
      });
      toast.success(`Podmínky zakázky uloženy — ${productTitle}`);
      setOpen(false);
      onSaved?.();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Podmínky se nepodařilo uložit."
      ),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Zakázková výroba — {productTitle}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          {(isLoading || !form) && (
            <Text size="small" className="text-ui-fg-subtle">
              Načítám…
            </Text>
          )}

          {form && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Vyrábí se na zakázku</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    Vypnuto = běžný produkt, prodává se ze skladu.
                  </Text>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, enabled: checked })
                  }
                />
              </div>

              <div>
                <Label htmlFor="deposit-floor">
                  Minimální záloha (%)
                </Label>
                <Input
                  id="deposit-floor"
                  type="number"
                  min={1}
                  max={100}
                  value={form.default_deposit_percentage}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      default_deposit_percentage: event.target.value,
                    })
                  }
                />
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  Míň než tohle zákazník při objednávce nezaplatí — posuvník
                  v pokladně začíná tady. Nastavte tak, aby pokryla materiál.
                </Text>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Povolit platbu celé částky předem</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    Vypnuto = zákazník zaplatí jen zálohu, zbytek po
                    dokončení.
                  </Text>
                </div>
                <Switch
                  checked={form.allow_full_prepayment}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, allow_full_prepayment: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="days-min">Výroba od (dní)</Label>
                  <Input
                    id="days-min"
                    type="number"
                    min={1}
                    value={form.production_time_min_days}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        production_time_min_days: event.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="days-max">do (dní)</Label>
                  <Input
                    id="days-max"
                    type="number"
                    min={1}
                    value={form.production_time_max_days}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        production_time_max_days: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Vyžadovat popis provedení</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    Zákazník musí napsat, co přesně chce, jinak objednávku
                    nedokončí.
                  </Text>
                </div>
                <Switch
                  checked={form.specification_required}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, specification_required: checked })
                  }
                />
              </div>

              <div>
                <Label htmlFor="spec-prompt">Otázka pro zákazníka</Label>
                <Textarea
                  id="spec-prompt"
                  rows={2}
                  placeholder="Např.: Popište barvu, velikost a k čemu má sloužit."
                  value={form.specification_prompt}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      specification_prompt: event.target.value,
                    })
                  }
                />
              </div>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Zrušit
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={!form}
            onClick={() => form && save.mutate(form)}
          >
            Uložit
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
