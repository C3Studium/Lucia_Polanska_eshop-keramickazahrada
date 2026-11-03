import { Eye, EyeSlash } from "@medusajs/icons";
import { toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ceskaChyba } from "../lib/ceska-chyba";
import { toastWithUndo } from "../lib/undo";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * The eye — show/hide something on the storefront (Matěj, 2026-08-12).
 *
 * One icon, one meaning, everywhere: an open eye means customers see it,
 * a crossed eye means they don't, and clicking it flips that.
 *
 * Skrytí se neptá: je vratné a nikomu nic neposílá, takže se rovnou udělá
 * a hláška nabídne „Vrátit zpět" — omyl se tak opraví ve chvíli,
 * kdy je vidět (pravidlo v confirm-dialog.tsx). Zobrazení se ptá dál:
 * kus je hned v obchodě a zákazník ho může uvidět a koupit dřív, než se
 * omyl vrátí.
 *
 * The component does not know what it is hiding; the caller passes the flip
 * as `onToggle(nextVisible)` (product status, category is_active, collection
 * metadata). Cíl jde v parametru, ne z vykreslení — vrácení zpět běží později
 * a se starým stavem by místo vrácení skrylo podruhé.
 */
export const VisibilityEye = ({
  visible,
  label,
  hideText,
  showText,
  onToggle,
  onDone,
}: {
  /** Current storefront visibility. */
  visible: boolean;
  /** Accusative name for the prompt title, e.g. „kategorii Květiny". */
  label: string;
  /** Consequence sentence shown after hiding (in the undo toast). */
  hideText: string;
  /** Consequence sentence shown when about to show. */
  showText: string;
  /** Performs the flip to `nextVisible`; throw to report failure. */
  onToggle: (nextVisible: boolean) => Promise<unknown>;
  /** Refresh lists after a successful flip. */
  onDone?: () => Promise<unknown> | void;
}) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (nextVisible: boolean) => onToggle(nextVisible),
    onSuccess: async (_, nextVisible) => {
      await onDone?.();
      if (nextVisible) {
        toast.success("Zobrazeno v obchodě.");
        return;
      }
      toastWithUndo(
        "Skryto z obchodu.",
        "Skrytí z obchodu",
        async () => {
          await onToggle(true);
          // Vrácení není mutace, takže ho společné „po zápisu obnovit vše"
          // (lib/query-client.ts) nezachytí — obnovit ručně, celé.
          await queryClient.invalidateQueries();
        },
        // Bez zmínky o Ctrl+Z — zkratka neběží na každé stránce s okem.
        hideText
      );
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Změna se nepodařila.")
      ),
  });

  const eye = (
    <button
      type="button"
      title={visible ? "Skrýt v obchodě" : "Zobrazit v obchodě"}
      disabled={mutation.isPending}
      onClick={visible ? () => mutation.mutate(false) : undefined}
      className={
        visible
          ? "text-ui-fg-subtle hover:text-ui-fg-base"
          : "text-ui-fg-muted hover:text-ui-fg-base"
      }
    >
      {visible ? <Eye /> : <EyeSlash />}
    </button>
  );

  if (visible) {
    return eye;
  }

  return (
    <ConfirmDialog
      trigger={eye}
      destructive={false}
      title={`Zobrazit ${label} v obchodě?`}
      description={showText}
      confirmLabel="Zobrazit"
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate(true)}
    />
  );
};
