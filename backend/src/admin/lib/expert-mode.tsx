import { Switch, Text } from "@medusajs/ui";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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

/* Značka na <html> pro CSS: karty Metadata/JSON v Medusiných detailech se
   bez expertního režimu schovávají (lib/citelnost.css, 14. 11. 2026). */
const oznac = (on: boolean) => {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.kzExpert = on ? "1" : "0";
  }
};
oznac(current);

export const setExpertMode = (on: boolean) => {
  current = on;
  oznac(on);
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

/*
 * Jedno místo pro přepínač (14. 11. 2026): horní lišta vpravo, vedle zvonku.
 * Dřív si ho každá stránka kreslila jinam (vpravo nahoře, u hledání, dole
 * v boku detailu) a nebyl k nalezení. Stránky ho dál „vkládají" jako dřív;
 * všechny kopie ale jdou do jednoho pevného slotu a vidět je jen první.
 */
const SLOT_ID = "kz-expert-slot";
const slot = (): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(SLOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = SLOT_ID;
    document.body.appendChild(el);
  }
  return el;
};

/** The header control every workbench mounts. */
export const ExpertToggle = () => {
  const expert = useExpertMode();
  const cil = slot();
  const prepinac = (
    <label className="flex items-center gap-2">
      <Switch checked={expert} onCheckedChange={setExpertMode} />
      <Text size="xsmall" className="text-ui-fg-subtle">
        Expertní režim
      </Text>
    </label>
  );
  return cil ? createPortal(prepinac, cil) : prepinac;
};

/** A copyable identifier — the reason you want an ID is to paste it somewhere. */
export const CopyId = ({ value }: { value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <button
      type="button"
      className="text-ui-fg-muted txt-xsmall font-mono hover:text-ui-fg-base block max-w-full truncate text-left"
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
