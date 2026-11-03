import { Button, Text, clx } from "@medusajs/ui";
import type { ReactNode } from "react";

/**
 * Lišta Uložit / Zahodit pod formulářem nastavení.
 *
 * Lepí se ke spodku okna: formuláře nastavení bývají dlouhé a „Uložit" má být
 * po ruce i na telefonu, ne až za posledním polem. Vedle tlačítka říká, jestli
 * je něco neuložené, a nabídne to zahodit — bez toho se rozepsaná změna
 * pozná jen tak, že po odchodu ze stránky zmizí.
 *
 * Jen pro stránky, kde se ukládá tlačítkem. Kde se ukládá samo (produkty,
 * zakázky, objednávky, ceny balení), se nepoužívá.
 */
export const SaveBar = ({
  dirty,
  count,
  saving,
  onSave,
  onDiscard,
  problem,
  sticky = true,
}: {
  /** Je na obrazovce něco jiného, než je uložené? */
  dirty: boolean;
  /** Kolik polí je změněných — kde to jde spočítat. */
  count?: number;
  saving: boolean;
  onSave: () => void;
  /** Vrátí formulář na uložené hodnoty. */
  onDiscard: () => void;
  /** Proč teď uložit nejde (špatně vyplněné pole) — tlačítko pak nesvítí. */
  problem?: ReactNode;
  /** Vypnout lepení — pro malý formulář uprostřed jiné stránky. */
  sticky?: boolean;
}) => (
  <footer
    className={clx(
      "flex flex-wrap items-center gap-3 px-6 py-4",
      sticky && "sticky bottom-0 z-10 rounded-b-lg bg-ui-bg-base"
    )}
  >
    <Button
      size="base"
      disabled={!dirty || Boolean(problem) || saving}
      isLoading={saving}
      onClick={onSave}
    >
      Uložit
    </Button>
    {problem ? (
      <Text size="small" className="text-ui-fg-error">
        {problem}
      </Text>
    ) : dirty ? (
      <>
        <Text size="small" className="text-ui-fg-subtle">
          {count === 1
            ? "Neuložená změna"
            : count
              ? `Neuložené změny: ${count}`
              : "Neuložené změny"}
        </Text>
        <Button size="small" variant="transparent" disabled={saving} onClick={onDiscard}>
          Zahodit
        </Button>
      </>
    ) : sticky ? (
      <Text size="small" className="text-ui-fg-muted">
        Vše je uložené.
      </Text>
    ) : null}
  </footer>
);
