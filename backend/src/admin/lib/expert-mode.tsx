import { Switch, Text } from "@medusajs/ui";
import { useSyncExternalStore } from "react";

/**
 * Expertní režim — the OrcaSlicer toggle (Matěj, 2026-08-06).
 *
 * One switch, all workbenches obey it: technical identifiers appear
 * (click-to-copy), expansions gain the raw payload, and list endpoints are
 * asked for their untrimmed form (`?expert=1`). Off by default and persisted
 * in localStorage — she never touches it, Matěj flips it once.
 *
 * **Read-only amplification by design.** Expert mode reveals everything and
 * unlocks no extra writes; the moment raw data becomes generally editable
 * we have rebuilt pgAdmin with worse guardrails.
 *
 * Implemented as a tiny external store rather than React context so five
 * separate page roots (each with its own QueryClientProvider) share one
 * truth without a shared provider.
 */

const STORAGE_KEY = "kz-expert-mode";
const listeners = new Set<() => void>();

const read = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

let current = read();

export const setExpertMode = (on: boolean) => {
  current = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Private windows forbid storage; the toggle still works for the session.
  }
  listeners.forEach((listener) => listener());
};

export const useExpertMode = (): boolean =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );

/** The header control every workbench mounts. */
export const ExpertToggle = () => {
  const expert = useExpertMode();
  return (
    <label className="flex items-center gap-2">
      <Switch checked={expert} onCheckedChange={setExpertMode} />
      <Text size="xsmall" className="text-ui-fg-subtle">
        Expertní režim
      </Text>
    </label>
  );
};

/** A copyable identifier — the reason you want an ID is to paste it somewhere. */
export const CopyId = ({ value }: { value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <button
      type="button"
      className="text-ui-fg-muted txt-xsmall font-mono hover:text-ui-fg-base text-left break-all"
      title="Kliknutím zkopírujete"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
      }}
    >
      {value}
    </button>
  );
};

/** Raw payload viewer for expansions — the complete truth, pretty-printed. */
export const RawData = ({ data }: { data: unknown }) => {
  const expert = useExpertMode();
  if (!expert || data === undefined || data === null) return null;
  return (
    <details className="border-ui-border-base mt-3 rounded-lg border">
      <summary className="text-ui-fg-muted txt-xsmall cursor-pointer px-3 py-2 select-none">
        Surová data
      </summary>
      <pre className="text-ui-fg-subtle txt-xsmall overflow-x-auto px-3 pb-3 font-mono leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
};
