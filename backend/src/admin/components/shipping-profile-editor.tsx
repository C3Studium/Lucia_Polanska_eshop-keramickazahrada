import {
  Button,
  Drawer,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * „Doprava a balení" — the two shipping facts that belong to a piece, not to the shop.
 *
 * ## Fragile
 *
 * Declared by her, never inferred. Nothing in the catalogue implies it: a heavy piece can
 * travel fine and a light one can be a stem with a petal on top. When anything in the basket
 * carries this, checkout drops every carriage except **Česká pošta – křehké** and leaves
 * Osobní odběr — the customer is told why, and cannot choose around it.
 *
 * ## Balení
 *
 * What the wrapping for this piece costs her — bubble wrap, paper, tape. Added to the
 * carriage at checkout so the number the customer pays is the number the parcel costs.
 * Empty means „use the shop default", so the catalogue works before she has priced a single
 * piece and gets more accurate with each one she does.
 *
 * There is no separate box cost anywhere. Decided with the owner on 2026-08-07: the box is
 * folded into this number. A small flower is wrapped for 5 Kč; when materials get dearer she
 * raises it to 8. She buys the materials, so she is the one who knows — and one adjustable
 * number beats a packing model that needs every piece measured and still argues with a
 * stem-and-petal flower. Balení+ edits these in bulk.
 */
export const ShippingProfileEditor = ({
  productId,
  productTitle,
  fragile,
  packagingPrice,
  trigger,
}: {
  productId: string;
  productTitle: string;
  fragile: boolean;
  packagingPrice: number | null;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [isFragile, setIsFragile] = useState(fragile);
  const [price, setPrice] = useState(
    packagingPrice === null ? "" : String(packagingPrice)
  );
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () => {
      const trimmed = price.trim();
      const parsed = trimmed === "" ? null : Number(trimmed);

      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error("Cena balení musí být kladné číslo, nebo prázdná.");
      }

      // Merges rather than replacing — the native product endpoint would wipe
      // clearance and dobírka off this piece.
      return sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: {
          fragile: isFragile,
          // Explicit null clears it back to the shop default rather than
          // freezing whatever was typed once.
          packaging_price: parsed,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(`${productTitle} — doprava a balení uloženy.`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Uložení se nepodařilo."
      ),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Doprava a balení — {productTitle}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label size="small" weight="plus">
                Křehké
              </Label>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Pokud je v košíku cokoli křehkého, zákazník uvidí jen Českou
                poštu – křehké a osobní odběr. Jinou dopravu zvolit nepůjde.
              </Text>
            </div>
            <Switch
              checked={isFragile}
              onCheckedChange={setIsFragile}
              aria-label="Křehké"
            />
          </div>

          <div>
            <Label size="small" weight="plus">
              Cena balení (Kč)
            </Label>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1 mb-2">
              Co vás stojí zabalit tenhle kus — bublinková fólie, papír, páska
              i krabice. Připočítá se k dopravě. Prázdné = výchozí cena obchodu.
            </Text>
            <Input
              size="small"
              type="number"
              min={0}
              placeholder="výchozí"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>

          <Text size="xsmall" className="text-ui-fg-muted">
            Ceny všech produktů najednou upravíte v Balení+.
          </Text>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            size="small"
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            Uložit
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
