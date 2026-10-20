import { toast } from "@medusajs/ui";
import { useEffect, useSyncExternalStore } from "react";
import { ceskaChyba } from "./ceska-chyba";

/**
 * Vrácení zpět — Ctrl+Z pro celý admin (admin-ux-spec §1, §2).
 *
 * ## Proč zásobník, a ne jen tlačítko v hlášce
 *
 * Hláška zmizí za pár vteřin — dřív, než si člověk stihne všimnout, že se
 * spletl. Ctrl+Z je návyk, který má i ten, kdo o počítačích nic neví,
 * protože ho zná z Wordu. Takže obojí: tlačítko v hlášce pro myš a Ctrl+Z
 * pro ruku, obojí vrací tutéž věc.
 *
 * ## Co se do zásobníku dává
 *
 * Jen úkony, které sáhly na víc než jeden údaj nebo na víc než jeden kus —
 * hromadná změna, archivace výběru, dávkový přesun objednávek. Jednotlivé
 * pole má vrácení u sebe (§1) a do zásobníku nepatří: jinak by Ctrl+Z po
 * přepsání ceny vrátil archivaci dvanácti kusů.
 *
 * ## Proč to vyprší
 *
 * Vrácení zapisuje hodnoty, které platily v okamžiku úkonu. Za deset minut
 * už mezitím mohl přijít objednávka, webhook nebo druhý člověk, a zápis
 * staré hodnoty by tiše přemazal něco novějšího. Starší záznamy se proto
 * nenabízejí — mlčky, protože „vypršelo" by nikomu nic neřeklo.
 *
 * Implementováno jako drobný externí store (stejně jako expertní režim):
 * každá stránka adminu má vlastní React kořen s vlastním QueryClientem,
 * takže společný provider není kam pověsit.
 */

export type UndoEntry = {
  id: number;
  /** Co se vrátí, slovy: „Archivace 12 kusů". Vidí ji v hlášce. */
  label: string;
  undo: () => Promise<unknown>;
  at: number;
};

/** Jak dlouho se vrácení nabízí. */
const PLATNOST_MS = 10 * 60 * 1000;
/** Kolik úkonů si pamatujeme — hlouběji už nikdo nepřemýšlí. */
const HLOUBKA = 20;

let stack: UndoEntry[] = [];
let poradi = 0;
let running = false;
const listeners = new Set<() => void>();

const oznam = () => listeners.forEach((listener) => listener());

const zive = (now: number) => stack.filter((entry) => now - entry.at < PLATNOST_MS);

/**
 * Zaregistruje vrácení. Vrací id, kterým se dá vrátit právě tenhle úkon —
 * tlačítko ve staré hlášce tak nevrátí něco, co se stalo mezitím.
 */
export const pushUndo = (label: string, undo: () => Promise<unknown>): number => {
  const id = ++poradi;
  stack = [...zive(Date.now()), { id, label, undo, at: Date.now() }].slice(-HLOUBKA);
  oznam();
  return id;
};

/** Zahodí záznam bez provedení — po úkonu, který předchozí vrácení zneplatnil. */
export const dropUndo = (id: number) => {
  const next = stack.filter((entry) => entry.id !== id);
  if (next.length !== stack.length) {
    stack = next;
    oznam();
  }
};

const proved = async (entry: UndoEntry) => {
  if (running) {
    return;
  }
  running = true;
  stack = stack.filter((item) => item.id !== entry.id);
  oznam();
  try {
    await entry.undo();
    toast.success(`Vráceno zpět: ${entry.label.toLowerCase()}.`);
  } catch (error) {
    toast.error(ceskaChyba(error, "Vrácení se nepodařilo."));
  } finally {
    running = false;
  }
};

/** Vrátí konkrétní úkon — pro tlačítko „Vrátit zpět" v hlášce. */
export const undoById = async (id: number) => {
  const entry = zive(Date.now()).find((item) => item.id === id);
  if (!entry) {
    toast.info("Tohle už vrátit nejde — mezitím se stalo něco dalšího.");
    return;
  }
  await proved(entry);
};

/** Vrátí poslední úkon — pro Ctrl+Z. */
export const undoLast = async () => {
  const entries = zive(Date.now());
  const entry = entries[entries.length - 1];
  if (!entry) {
    toast.info("Není co vrátit.");
    return;
  }
  await proved(entry);
};

/** Pro ovládání v hlavičce stránky — co by Ctrl+Z vrátil. */
export const useLastUndo = (): UndoEntry | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => {
      const entries = zive(Date.now());
      return entries.length ? entries[entries.length - 1] : null;
    }
  );

/**
 * Ctrl+Z (a ⌘Z) na stránce.
 *
 * **Uvnitř psaní se nechytá.** V poli, textarea nebo editovatelném bloku
 * patří Ctrl+Z prohlížeči — vrací napsaná písmena. Sebrat jí tam zkratku a
 * místo písmena vrátit archivaci dvanácti produktů by bylo horší než
 * nemít zkratku vůbec.
 */
export const useUndoHotkey = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      void undoLast();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};

/**
 * Hláška o hotovém úkonu, která rovnou nabídne vrácení.
 *
 * Deset vteřin — tolik trvá, než si člověk všimne, že se spletl. Pak ještě
 * deset minut funguje Ctrl+Z, takže zmizení hlášky není konec.
 */
export const toastWithUndo = (
  title: string,
  label: string,
  undo: () => Promise<unknown>,
  description?: string
) => {
  const id = pushUndo(label, undo);
  toast.success(title, {
    description: description ?? "Vrátit můžete i klávesami Ctrl+Z.",
    duration: 10000,
    action: {
      label: "Vrátit zpět",
      altText: `Vrátit zpět: ${label}`,
      onClick: () => {
        void undoById(id);
      },
    },
  });
};
