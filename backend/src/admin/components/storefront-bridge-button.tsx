import { ArrowUpRightOnBox } from "@medusajs/icons";
import { Button, toast } from "@medusajs/ui";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * „Otevřít web jako admin" — one button, two homes (the product widget and
 * Přehled), so the way onto the live site is the same gesture wherever you
 * start.
 *
 * It asks `/admin/storefront-bridge` for a handover token and opens the
 * storefront with it; the storefront swaps the token for a first-party cookie
 * of its own and starts showing the admin bar. Why the session cannot simply
 * be shared is written down once, in `lib/admin-bridge-token.ts`.
 */
export const StorefrontBridgeButton = ({
  path = "/",
  label = "Otevřít web jako admin",
  variant = "secondary",
}: {
  /** Storefront path to land on, including the country segment. */
  path?: string;
  label?: string;
  variant?: "primary" | "secondary" | "transparent";
}) => {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    // Opened synchronously, before the await: a popup blocker only trusts a
    // window a click opened, and one opened after an await lands in the blocker.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { url } = (await sdk.client.fetch(
        `/admin/storefront-bridge?path=${encodeURIComponent(path)}`
      )) as { url: string };
      if (tab) {
        tab.location.href = url;
      } else {
        // Blocked anyway — going in place still beats doing nothing.
        window.location.href = url;
      }
    } catch (error) {
      tab?.close();
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";
      toast.error(
        message && message.length > 4
          ? message
          : "Web se nepodařilo otevřít. Zkuste to prosím znovu."
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <Button size="small" variant={variant} isLoading={opening} onClick={open}>
      {label} <ArrowUpRightOnBox />
    </Button>
  );
};
