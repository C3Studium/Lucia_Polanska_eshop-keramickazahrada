import { Button, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sdk } from "../lib/sdk";

/**
 * „Nový …" — the create button for whichever tab of Produkty+ is open.
 *
 * ## The gap this closes
 *
 * Every tab of the workbench listed its kind and let her edit it, but only
 * Balíčky could *start* one. The empty states admitted it: „Produkt zařadíte
 * mezi zakázky v záložce Produkty akcí ‚Nastavit jako zakázku'" — that is a
 * three-step detour told to you by the very screen that could have done it,
 * and it means the answer to „add one of these" depends on which tab you
 * happen to be standing in.
 *
 * ## Why a product first, then the marking
 *
 * A kind is not a field on a product. It is derived (`workbench/products`):
 * a production profile makes a zakázka, a bundle makes a balíček,
 * `metadata.clearance` makes a poškozený kus. So each button creates a plain
 * draft through the native API and then applies the one mark that lands it in
 * the tab she was already looking at — after which the native editor takes
 * over, exactly as „Nový produkt" already does.
 *
 * Everything is created as a **draft**. Nothing reaches the shop because
 * somebody clicked a button.
 */

export type ProductKindTab = "produkty" | "zakazky" | "poskozene";

const drafts: Record<
  ProductKindTab,
  { label: string; title: string; toast: string }
> = {
  produkty: {
    label: "Nový produkt",
    title: "Nový produkt",
    toast: "Produkt založen — teď mu přidejte fotku a cenu.",
  },
  zakazky: {
    label: "Nová zakázka",
    title: "Nová zakázka",
    toast: "Zakázka založena — zálohu a termín upravíte v Podmínkách.",
  },
  poskozene: {
    label: "Nový poškozený kus",
    title: "Poškozený kus",
    toast: "Kus založen a zařazen do výprodeje poškozených.",
  },
};

export const NewOfKind = ({ kind }: { kind: ProductKindTab }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = drafts[kind];

  const create = useMutation({
    mutationFn: async () => {
      const created: any = await sdk.admin.product.create({
        title: draft.title,
        status: "draft",
        options: [{ title: "Provedení", values: ["Standardní"] }],
        variants: [
          {
            title: "Standardní",
            manage_inventory: true,
            options: { Provedení: "Standardní" },
          },
        ],
      } as never);

      const productId = created?.product?.id;
      if (!productId) {
        throw new Error("Produkt se založil, ale nevrátil ID.");
      }

      /*
       * The mark that decides the tab. It is deliberately a second call: if it
       * fails the product still exists as an ordinary draft, which is
       * recoverable from the Produkty tab — whereas a rolled-back create would
       * lose whatever the native editor had already been handed.
       */
      if (kind === "zakazky") {
        await sdk.client.fetch(`/admin/made-to-order/products/${productId}`, {
          method: "PATCH",
          body: { enabled: true },
        });
      }

      if (kind === "poskozene") {
        await sdk.client.fetch(
          `/admin/workbench/products/${productId}/flags`,
          { method: "POST", body: { clearance: true } }
        );
      }

      return productId as string;
    },
    onSuccess: async (productId) => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(draft.toast);
      navigate(`/products/${productId}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Nový záznam se nepodařilo založit."
      ),
  });

  return (
    <Button
      size="small"
      variant="secondary"
      isLoading={create.isPending}
      onClick={() => create.mutate()}
    >
      {draft.label}
    </Button>
  );
};
