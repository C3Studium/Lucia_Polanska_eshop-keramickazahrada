import { EllipsisHorizontal } from "@medusajs/icons";
import { DropdownMenu, IconButton } from "@medusajs/ui";
import { useRef, type ReactNode } from "react";

/**
 * „…" na konci řádku — vedlejší akce schované do nabídky (17. 11. 2026).
 *
 * Lucie potřebuje v řádku jednu jasnou věc (klik = vybrat), ne řadu drobných
 * odkazů vedle sebe. Všechno ostatní (přejmenovat, fotka, skrýt, smazat) je
 * tady, s velkými položkami pro prst i myš a mazáním červeně až za čarou.
 *
 * Akce se spouští až po zavření nabídky (`setTimeout`): dialog nebo pole,
 * které otevře, jinak soupeří s nabídkou o fokus. Výjimka `sync` je pro výběr
 * souboru — Safari otevře okno se soubory jen přímo z kliknutí.
 */
export type RowOption =
  | "separator"
  | {
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      /** Červeně — akce, která něco ničí. */
      destructive?: boolean;
      /** Spustit hned v kliknutí (výběr souboru), ne až po zavření nabídky. */
      sync?: boolean;
      /** Akce si fokus vezme sama (pole pro přejmenování) — nevracet ho na „…". */
      takesFocus?: boolean;
    };

export const RowOptionsMenu = ({
  label,
  items,
}: {
  /** Přístupný název tlačítka, např. „Možnosti kolekce Hrnečky". */
  label: string;
  items: RowOption[];
}) => {
  const skipFocusReturn = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton
          type="button"
          variant="transparent"
          size="large"
          aria-label={label}
          title="Další možnosti"
          className="shrink-0"
        >
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        className="min-w-[240px]"
        onCloseAutoFocus={(event) => {
          if (skipFocusReturn.current) {
            event.preventDefault();
            skipFocusReturn.current = false;
          }
        }}
      >
        {items.map((item, index) =>
          item === "separator" ? (
            <DropdownMenu.Separator key={`sep-${index}`} />
          ) : (
            <DropdownMenu.Item
              key={item.label}
              className={
                item.destructive
                  ? "text-ui-fg-error txt-compact-medium min-h-10 gap-x-3 px-3"
                  : "txt-compact-medium min-h-10 gap-x-3 px-3"
              }
              onSelect={() => {
                if (item.takesFocus) skipFocusReturn.current = true;
                if (item.sync) item.onSelect();
                else setTimeout(item.onSelect, 0);
              }}
            >
              {item.icon ? (
                <span
                  className={
                    item.destructive ? "text-ui-fg-error" : "text-ui-fg-subtle"
                  }
                >
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </DropdownMenu.Item>
          )
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
