import { Eye, EyeSlash } from "@medusajs/icons";
import { Prompt, toast } from "@medusajs/ui";
import { useMutation } from "@tanstack/react-query";

/**
 * The eye — show/hide something on the storefront (Matěj, 2026-08-12).
 *
 * One icon, one meaning, everywhere: an open eye means customers see it,
 * a crossed eye means they don't, and clicking it flips that. Both
 * directions go through a confirmation prompt on purpose — hiding a whole
 * category is exactly the kind of misclick that must not happen silently,
 * and unhiding puts things back in front of customers just as quietly.
 *
 * The component does not know what it is hiding; the caller passes the flip
 * as `onToggle` (product status, category is_active, collection metadata).
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
  /** Consequence sentence shown when about to hide. */
  hideText: string;
  /** Consequence sentence shown when about to show. */
  showText: string;
  /** Performs the actual flip; throw to report failure. */
  onToggle: () => Promise<unknown>;
  /** Refresh lists after a successful flip. */
  onDone?: () => Promise<unknown> | void;
}) => {
  const mutation = useMutation({
    mutationFn: onToggle,
    onSuccess: async () => {
      await onDone?.();
      toast.success(visible ? "Skryto z obchodu." : "Zobrazeno v obchodě.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Změna se nepodařila."
      ),
  });

  return (
    <Prompt>
      <Prompt.Trigger asChild>
        <button
          type="button"
          title={visible ? "Skrýt v obchodě" : "Zobrazit v obchodě"}
          className={
            visible
              ? "text-ui-fg-subtle hover:text-ui-fg-base"
              : "text-ui-fg-muted hover:text-ui-fg-base"
          }
        >
          {visible ? <Eye /> : <EyeSlash />}
        </button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>
            {visible ? `Skrýt ${label} z obchodu?` : `Zobrazit ${label} v obchodě?`}
          </Prompt.Title>
          <Prompt.Description>
            {visible ? hideText : showText}
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zrušit</Prompt.Cancel>
          <Prompt.Action
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {visible ? "Skrýt" : "Zobrazit"}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
