import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Creating a discount code or an automatic discount, without leaving Přehled.
 *
 * ## What this covers, and what it does not
 *
 * §13 describes four instruments and this handles two of them: the code a
 * customer types, and the discount that applies by itself. Between them they
 * are almost everything a shop this size runs — „SLEVA10", and „doprava zdarma
 * nad 1 500 Kč".
 *
 * It deliberately does **not** try to be the native promotion editor. Buy-get
 * offers, campaign budgets and rule builders exist there and stay there; a
 * simplified form pretending to be all of it would either hide options she
 * needs or grow into the same screen with fewer tests. The link out is the
 * honest answer for the rare case.
 *
 * ## Why free shipping is its own choice
 *
 * „100 % off shipping" is the native shape, and nobody thinks of it that way.
 * The form asks what she means — money off the order, or free delivery — and
 * translates.
 */

type DiscountKind = "order" | "shipping"

export const DiscountEditor = ({ trigger }: { trigger: React.ReactNode }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [automatic, setAutomatic] = useState(false)
  const [code, setCode] = useState("")
  const [kind, setKind] = useState<DiscountKind>("order")
  const [method, setMethod] = useState<"percentage" | "fixed">("percentage")
  const [value, setValue] = useState("10")

  const save = useMutation({
    mutationFn: () => {
      const numeric = Number(value)

      return sdk.client.fetch("/admin/promotions", {
        method: "POST",
        body: {
          // Automatic discounts still need a code internally; she never sees
          // it, so it is generated rather than asked for.
          code: automatic
            ? `AUTO-${Date.now().toString(36).toUpperCase()}`
            : code.trim().toUpperCase(),
          type: "standard",
          is_automatic: automatic,
          status: "active",
          application_method: {
            type: kind === "shipping" ? "percentage" : method,
            // Free shipping is „100 % off the shipping method" — the native
            // shape, and not how anyone thinks about it.
            value: kind === "shipping" ? 100 : numeric,
            target_type: kind === "shipping" ? "shipping_methods" : "order",
            allocation: "across",
            ...(kind === "order" && method === "fixed"
              ? { currency_code: "czk" }
              : {}),
          },
        },
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operations-discounts"] })
      toast.success(automatic ? "Automatická sleva vytvořena" : "Slevový kód vytvořen")
      setOpen(false)
      setCode("")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Slevu se nepodařilo vytvořit"
      ),
  })

  const numeric = Number(value)
  const valueValid =
    kind === "shipping" ||
    (Number.isFinite(numeric) &&
      numeric > 0 &&
      (method === "fixed" || numeric <= 100))
  const canSave = valueValid && (automatic || code.trim().length >= 3)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Nová sleva</Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <label className="bg-ui-bg-subtle flex cursor-pointer items-center justify-between gap-4 rounded-lg p-4">
            <span>
              <Text size="small" weight="plus">
                Platí sama, bez kódu
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                Např. doprava zdarma pro každého. Zákazník nic nezadává.
              </Text>
            </span>
            <Switch checked={automatic} onCheckedChange={setAutomatic} />
          </label>

          {!automatic && (
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor="discount-code">
                Kód, který zákazník zadá
              </Label>
              <Input
                id="discount-code"
                placeholder="SLEVA10"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
          )}

          <div className="flex flex-col gap-y-1">
            <Label size="xsmall">Co sleva dělá</Label>
            <Select
              value={kind}
              onValueChange={(next) => setKind(next as DiscountKind)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="order">Sleva z ceny objednávky</Select.Item>
                <Select.Item value="shipping">Doprava zdarma</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {kind === "order" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall">Sleva</Label>
                <Select
                  value={method}
                  onValueChange={(next) =>
                    setMethod(next as "percentage" | "fixed")
                  }
                >
                  <Select.Trigger className="w-40">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="percentage">Procenta</Select.Item>
                    <Select.Item value="fixed">Pevná částka</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall" htmlFor="discount-value">
                  {method === "percentage" ? "Kolik %" : "Kolik Kč"}
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  min={1}
                  max={method === "percentage" ? 100 : undefined}
                  className="w-32"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </div>
            </div>
          )}

          {!valueValid && (
            <Text size="small" className="text-ui-fg-error">
              Procenta musí být mezi 1 a 100.
            </Text>
          )}

          <Text size="xsmall" className="text-ui-fg-muted">
            Složitější slevy — třeba „kup dva, třetí zdarma" nebo sleva jen na
            vybranou kolekci — se nastavují v pokročilém nastavení propagací.
          </Text>
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Zpět
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={!canSave}
            onClick={() => save.mutate()}
          >
            Vytvořit slevu
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
