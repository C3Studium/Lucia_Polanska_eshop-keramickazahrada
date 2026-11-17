import { toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { toastWithUndo } from "../lib/undo";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Totéž co očko (`visibility-eye.tsx`), jen spouštěné z nabídky „…"
 * (17. 11. 2026). Očko má vlastní tlačítko, z položky nabídky ho nejde
 * zmáčknout, tak je tu jeho chování znovu a stejně:
 *
 * - skrytí se neptá — udělá se a hláška nabídne „Vrátit zpět",
 * - zobrazení se ptá, protože kus je hned vidět a koupit.
 *
 * Jeden háček na stránku: `toggle(...)` dostane, co a jak přepnout, a `dialog`
 * se vykreslí jednou kdekoli na stránce.
 */
export type VisibilityRequest = {
  /** Současný stav v obchodě. */
  visible: boolean;
  /** Čtvrtý pád do otázky, např. „kategorii Květiny". */
  label: string;
  /** Věta do hlášky po skrytí. */
  hideText: string;
  /** Věta do otázky před zobrazením. */
  showText: string;
  /** Přepne na `nextVisible`; chybu hlásí vyhozením. */
  onToggle: (nextVisible: boolean) => Promise<unknown>;
  /** Obnovit seznamy po zápisu. */
  onDone?: () => Promise<unknown> | void;
};

export const useVisibilityToggle = () => {
  const queryClient = useQueryClient();
  // Žádost zůstává i po zavření, aby se titulek při zavírací animaci nevyprázdnil.
  const [asking, setAsking] = useState<VisibilityRequest | null>(null);
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: ({ request, next }: { request: VisibilityRequest; next: boolean }) =>
      request.onToggle(next),
    onSuccess: async (_, { request, next }) => {
      await request.onDone?.();
      if (next) {
        toast.success("Zobrazeno v obchodě.");
        return;
      }
      toastWithUndo(
        "Skryto z obchodu.",
        "Skrytí z obchodu",
        async () => {
          // Cíl jde v parametru, ne ze stavu — vrácení běží později.
          await request.onToggle(true);
          await queryClient.invalidateQueries();
        },
        request.hideText
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Změna se nepodařila.")),
  });

  const toggle = (request: VisibilityRequest) => {
    if (request.visible) {
      mutation.mutate({ request, next: false });
      return;
    }
    setAsking(request);
    setOpen(true);
  };

  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      destructive={false}
      title={`Zobrazit ${asking?.label ?? ""} v obchodě?`}
      description={asking?.showText}
      confirmLabel="Zobrazit"
      isPending={mutation.isPending}
      onConfirm={() => {
        if (asking) mutation.mutate({ request: asking, next: true });
      }}
    />
  );

  return { toggle, dialog, isPending: mutation.isPending };
};
