import { ArrowUpRightOnBox, Trash } from "@medusajs/icons";
import { Button, Input, Prompt, Switch, Text } from "@medusajs/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { setExpertMode, useExpertMode } from "../lib/expert-mode";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * „…" v hlavičce detailu produktu — vzácné akce v malém okně (Matěj, 3. 11. 2026).
 *
 * V hlavičce zůstává jen to, co se dělá denně (publikovat/skrýt, zobrazit,
 * duplikovat); sleva, archiv, smazání a expertní věci jsou o klik dál.
 *
 * Sleva je druhý pohled téhož okna, ne vnořený dialog — formulář o dvou
 * polích nepotřebuje vlastní vrstvu. Smazání má vlastní potvrzení
 * (ConfirmDialog), protože jako jediné nejde vrátit.
 */
const ActionRow = ({
  label,
  description,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="hover:bg-ui-bg-base-hover flex w-full flex-col items-start rounded-md px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Text size="small" weight="plus">
      {label}
    </Text>
    <Text size="xsmall" className="text-ui-fg-subtle">
      {description}
    </Text>
  </button>
);

export const ProductMoreActions = ({
  productId,
  productTitle,
  priceLabel,
  damaged,
  archived,
  pending,
  onDiscount,
  onArchive,
  onDelete,
}: {
  productId: string;
  productTitle: string;
  /** Dnešní cena („450 Kč" / „450 Kč – 600 Kč"); `null` = není co zlevnit. */
  priceLabel: string | null;
  /** Kus už je označený jako poškozený — přepínač ve slevě pak není potřeba. */
  damaged: boolean;
  archived: boolean;
  pending: { discount: boolean; archive: boolean; remove: boolean };
  onDiscount: (input: { percent: number; markClearance: boolean }) => void;
  onArchive: (next: boolean) => void;
  onDelete: () => void;
}) => {
  const expert = useExpertMode();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "discount">("menu");
  const [percent, setPercent] = useState("20");
  const [markDamaged, setMarkDamaged] = useState(true);

  const percentValue = Number(percent);
  const percentOk =
    Number.isFinite(percentValue) && percentValue >= 1 && percentValue <= 99;

  return (
    <Prompt
      variant="confirmation"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("menu");
      }}
    >
      <Prompt.Trigger asChild>
        <Button
          size="small"
          variant="secondary"
          aria-label="Další akce"
          title="Další akce"
          isLoading={pending.discount || pending.archive || pending.remove}
        >
          …
        </Button>
      </Prompt.Trigger>
      {/* Na telefonu okraj kolem okna, ať je poznat, že je to okno. */}
      <Prompt.Content className="w-[calc(100%-2rem)]">
        {view === "menu" ? (
          <>
            <Prompt.Header>
              <Prompt.Title>Další akce</Prompt.Title>
              <Prompt.Description>{productTitle}</Prompt.Description>
            </Prompt.Header>
            <div className="flex flex-col px-3 pt-3">
              <ActionRow
                label="Zlevnit"
                description={
                  priceLabel
                    ? "Sníží cenu o zadaná procenta; původní cenu si zapamatuje."
                    : "Kus zatím nemá cenu — není co zlevnit."
                }
                disabled={!priceLabel}
                onClick={() => setView("discount")}
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
                  className="hover:bg-ui-bg-base-hover flex w-full flex-col items-start rounded-md px-3 py-2 text-left"
                >
                  <Text size="small" weight="plus" className="flex items-center gap-1">
                    Původní editace <ArrowUpRightOnBox />
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Nativní stránka Medusy — na to, co tahle stránka neumí.
                  </Text>
                </Link>
              )}
              <label className="flex cursor-pointer items-center justify-between gap-4 px-3 py-2">
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
        ) : (
          <>
            <Prompt.Header>
              <Prompt.Title>Zlevnit „{productTitle}"</Prompt.Title>
              <Prompt.Description>
                Sníží cenu všech provedení o zadaná procenta.
                {priceLabel ? ` Teď: ${priceLabel}.` : ""} Původní cena se
                zapamatuje.
              </Prompt.Description>
            </Prompt.Header>
            <div className="flex flex-col gap-3 px-6 py-3">
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  type="number"
                  min={1}
                  max={99}
                  className="w-20"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                />
                <Text size="small">% sleva</Text>
              </div>
              {!damaged && (
                <label className="flex items-center gap-2">
                  <Switch checked={markDamaged} onCheckedChange={setMarkDamaged} />
                  <Text size="small">Zároveň označit jako poškozený kus</Text>
                </label>
              )}
            </div>
            <Prompt.Footer>
              <Button size="small" variant="secondary" onClick={() => setView("menu")}>
                Zpět
              </Button>
              <Button
                size="small"
                disabled={!percentOk}
                isLoading={pending.discount}
                onClick={() => {
                  onDiscount({
                    percent: Math.round(percentValue),
                    markClearance: !damaged && markDamaged,
                  });
                  setOpen(false);
                  setView("menu");
                }}
              >
                Zlevnit
              </Button>
            </Prompt.Footer>
          </>
        )}
      </Prompt.Content>
    </Prompt>
  );
};
