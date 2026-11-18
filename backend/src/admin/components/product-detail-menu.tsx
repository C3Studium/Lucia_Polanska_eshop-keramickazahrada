import { ArrowUpRightOnBox, EllipsisHorizontal, Trash } from "@medusajs/icons";
import { Button, Prompt, Switch, Text } from "@medusajs/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { setExpertMode, useExpertMode } from "../lib/expert-mode";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * „…" v hlavičce detailu výrobku (17. 11. 2026).
 *
 * Nástupce `ProductMoreActions` (product-detail-actions.tsx), který navíc
 * nese Duplikovat a Skrýt z obchodu: v hlavičce teď zůstává jediné hlavní
 * tlačítko (Zobrazit v obchodě, u konceptu Publikovat), jak to mají aplikace
 * od Applu. Pořadí v okně = jak často se to dělá: kopie série, skrytí,
 * sleva, archiv; smazání zvlášť a červeně.
 */
const ActionRow = ({
  label,
  description,
  onClick,
  disabled,
}: {
  label: React.ReactNode;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="hover:bg-ui-bg-base-hover flex min-h-[44px] w-full flex-col items-start rounded-md px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Text size="small" weight="plus">
      {label}
    </Text>
    <Text size="xsmall" className="text-ui-fg-subtle">
      {description}
    </Text>
  </button>
);

export const ProductDetailMenu = ({
  productId,
  productTitle,
  priceLabel,
  archived,
  isPublished,
  storeUrl,
  pending,
  onDuplicate,
  onSetPublished,
  onDiscount,
  onArchive,
  onDelete,
}: {
  productId: string;
  productTitle: string;
  /** Dnešní cena („450 Kč" / „450 Kč – 600 Kč"); `null` = není co zlevnit. */
  priceLabel: string | null;
  archived: boolean;
  isPublished: boolean;
  /** U konceptu je hlavním tlačítkem Publikovat — odkaz do obchodu je tady. */
  storeUrl?: string | null;
  pending: {
    duplicate: boolean;
    visibility: boolean;
    archive: boolean;
    remove: boolean;
  };
  onDuplicate: () => void;
  onSetPublished: (next: boolean) => void;
  /** Dovede na řádek „Sleva" u ceny (lib/product-sale). */
  onDiscount: () => void;
  onArchive: (next: boolean) => void;
  onDelete: () => void;
}) => {
  const expert = useExpertMode();
  const [open, setOpen] = useState(false);
  const busy = Object.values(pending).some(Boolean);

  return (
    <Prompt
      variant="confirmation"
      open={open}
      onOpenChange={setOpen}
    >
      <Prompt.Trigger asChild>
        <Button
          variant="secondary"
          aria-label="Další akce"
          title="Další akce — duplikovat, skrýt, zlevnit, archivovat…"
          className="min-h-[40px] min-w-[40px]"
          isLoading={busy}
        >
          <EllipsisHorizontal />
        </Button>
      </Prompt.Trigger>
      {/* Na telefonu okraj kolem okna, ať je poznat, že je to okno. */}
      <Prompt.Content className="w-[calc(100%-2rem)]">
          <>
            <Prompt.Header>
              <Prompt.Title>Další akce</Prompt.Title>
              <Prompt.Description>{productTitle}</Prompt.Description>
            </Prompt.Header>
            <div className="flex flex-col px-3 pt-3">
              {/* Série (šest hrnků z jedné glazury) se zakládá kopírováním —
                  proto první řádek. */}
              <ActionRow
                label="Duplikovat"
                description="Založí kopii jako koncept — bez kódů a bez kusů na skladu."
                disabled={pending.duplicate}
                onClick={() => {
                  onDuplicate();
                  setOpen(false);
                }}
              />
              {isPublished ? (
                // Skrytí je vratné a nic neposílá, proto se dál neptá.
                <ActionRow
                  label="Skrýt z obchodu"
                  description="Zákazníci ho přestanou vidět. Vrátíte ho tlačítkem Publikovat."
                  disabled={pending.visibility}
                  onClick={() => {
                    onSetPublished(false);
                    setOpen(false);
                  }}
                />
              ) : (
                storeUrl && (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:bg-ui-bg-base-hover flex min-h-[44px] w-full flex-col items-start rounded-md px-3 py-2 text-left"
                  >
                    <Text size="small" weight="plus" className="flex items-center gap-1">
                      Zobrazit v obchodě <ArrowUpRightOnBox />
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Koncept zákazník nevidí — stránka se ukáže až po publikování.
                    </Text>
                  </a>
                )
              )}
              {/* Sleva (18. 11. 2026) se nastavuje u ceny — procenta, od–do,
                  vypnout. Tohle jen dovede na řádek „Sleva" v Ceně a skladu. */}
              <ActionRow
                label="Zlevnit"
                description={
                  priceLabel
                    ? "Sleva v % s datem od–do — nastavuje se u ceny (Cena a sklad)."
                    : "Kus zatím nemá cenu — není co zlevnit."
                }
                disabled={!priceLabel}
                onClick={() => {
                  setOpen(false);
                  onDiscount();
                }}
              />
              <ActionRow
                label={archived ? "Obnovit z archivu" : "Archivovat"}
                description={
                  archived
                    ? "Vrátí se jako koncept — do obchodu ho dáte publikováním."
                    : "Zmizí z obchodu i ze seznamů. Dá se kdykoli obnovit."
                }
                onClick={() => {
                  onArchive(!archived);
                  setOpen(false);
                }}
              />
              {expert && (
                <Link
                  to={`/products/${productId}?puvodni=1`}
                  className="hover:bg-ui-bg-base-hover flex min-h-[44px] w-full flex-col items-start rounded-md px-3 py-2 text-left"
                >
                  <Text size="small" weight="plus" className="flex items-center gap-1">
                    Původní editace <ArrowUpRightOnBox />
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Nativní stránka Medusy — na to, co tahle stránka neumí.
                  </Text>
                </Link>
              )}
              <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 px-3 py-2">
                <div>
                  <Text size="small" weight="plus">
                    Expertní režim
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Ukáže technické údaje, surová data a původní editaci.
                  </Text>
                </div>
                <Switch checked={expert} onCheckedChange={setExpertMode} />
              </label>
            </div>

            {/* Smazání odděleně a červeně — jediná akce, která nejde vrátit. */}
            <div className="mx-6 mt-3 border-t pt-3">
              <ConfirmDialog
                trigger={
                  <Button
                    size="small"
                    variant="transparent"
                    className="text-ui-fg-error hover:text-ui-fg-error"
                    isLoading={pending.remove}
                  >
                    <Trash /> Smazat produkt
                  </Button>
                }
                title={`Smazat „${productTitle}" nadobro?`}
                description="Objednávky si svoje údaje nechají, ale kus z katalogu zmizí."
                consequence="Smazání nejde vrátit. Když si nejste jistí, použijte radši Archivovat."
                confirmLabel="Smazat nadobro"
                isPending={pending.remove}
                onConfirm={onDelete}
              />
            </div>

            <Prompt.Footer>
              <Prompt.Cancel>Zavřít</Prompt.Cancel>
            </Prompt.Footer>
          </>
      </Prompt.Content>
    </Prompt>
  );
};
