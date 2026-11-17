import type { AdminOrder } from "@medusajs/framework/types";
import { ArrowDownTray } from "@medusajs/icons";
import { Button, toast } from "@medusajs/ui";
import { useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";

/**
 * „Stáhnout list pro dílnu (PDF)" — tentýž list, který chodí majitelce
 * v příloze e-mailu o nové objednávce, ale vyrobený načerstvo (zadání,
 * doplatek a poznámky podle dnešního stavu).
 *
 * Stahuje se přes přihlášenou relaci (`sdk.client.fetch` vrátí u PDF holou
 * odpověď) a ukládá jako soubor přes blob — přímý odkaz v novém okně by
 * přihlášení nenesl (stejně jako podací štítek, `admin/lib/stitky.ts`).
 */
export const WorkshopSheetButton = ({ order }: { order: AdminOrder }) => {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const response = await sdk.client.fetch<Response>(
        `/admin/orders/${order.id}/workshop-sheet`,
        { headers: { accept: "application/pdf" } }
      );
      const blob = await response.blob();
      const href = URL.createObjectURL(
        blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" })
      );
      const odkaz = document.createElement("a");
      odkaz.href = href;
      odkaz.download = `objednavka-${order.display_id ?? "bez-cisla"}-dilna.pdf`;
      odkaz.rel = "noopener";
      document.body.appendChild(odkaz);
      odkaz.click();
      odkaz.remove();
      // Prohlížeč si obsah drží, dokud stahování běží; URL po chvíli uklidíme.
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch (error) {
      toast.error(ceskaChyba(error, "List pro dílnu se nepodařilo stáhnout."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      onClick={download}
      isLoading={loading}
      disabled={loading}
    >
      <ArrowDownTray />
      Stáhnout list pro dílnu (PDF)
    </Button>
  );
};
