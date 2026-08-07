import { toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * „Archivovat" — retire a piece without destroying it.
 *
 * ## Why archiving and not deleting
 *
 * A product that has ever been sold owns its order history. Deleting it takes that with it —
 * old orders lose their line, statistics lose their subject, and a customer's order page
 * develops a hole. So the piece stays in the database and leaves the places she works.
 *
 * ## Two things happen, and both are necessary
 *
 * - **`archived`** removes it from the workbench lists. That is the admin half.
 * - **`status: draft`** removes it from the shop. That is the storefront half, and it is not
 *   optional: the storefront renders whatever Medusa publishes, and it has no idea what
 *   `archived` means. Setting only the flag would leave the piece quietly on sale.
 *
 * Restoring reverses only the first. The piece comes back as a **draft**, so nothing returns
 * to the shop because somebody clicked twice — republishing stays a deliberate act.
 *
 * Archiving beats the clearance auto-hide where both apply: the auto-hide is about a sold-out
 * piece waiting to be dealt with, and this is her dealing with it.
 */
export const ArchiveToggle = ({
  product,
}: {
  product: { id: string; title: string; archived: boolean };
}) => {
  const queryClient = useQueryClient();
  const archiving = !product.archived;

  const mutate = useMutation({
    mutationFn: async () => {
      await sdk.client.fetch(
        `/admin/workbench/products/${product.id}/flags`,
        { method: "POST", body: { archived: archiving } }
      );

      // Only on the way in. Coming back out it stays a draft on purpose.
      if (archiving) {
        await sdk.client.fetch(`/admin/products/${product.id}`, {
          method: "POST",
          body: { status: "draft" },
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      await queryClient.invalidateQueries({ queryKey: ["packaging-products"] });
      toast.success(
        archiving
          ? `${product.title} archivován — zmizel z obchodu i ze seznamů.`
          : `${product.title} obnoven jako koncept. Do obchodu ho vrátíte zveřejněním.`
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Změna se nepodařila."
      ),
  });

  return (
    <button
      type="button"
      className="text-ui-fg-subtle txt-small hover:underline"
      onClick={() => mutate.mutate()}
      disabled={mutate.isPending}
    >
      {archiving ? "Archivovat" : "Obnovit z archivu"}
    </button>
  );
};
