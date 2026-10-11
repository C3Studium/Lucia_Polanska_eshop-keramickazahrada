import type { ReactElement } from "react"

import {
  getGuestOrderEditCatalog,
  getGuestOrderEditContext,
} from "@lib/data/guest-order-edit"
import type { OrderEditCatalog } from "@lib/data/order-edit"
import OrderStateShell from "@modules/order/components/order-state-shell"

import type { PickSwapInfo } from "./pick-bar"
import { editPath } from "./shared"

/**
 * Vstup do mini obchodu úpravy (výpis i stránka produktu) — společná brána.
 *
 * Obě stránky se musí zeptat na totéž: platí token, nečeká změna na platbu,
 * dovolí server teď vybírat (`can_add` — přidání i výměna), a u výměny
 * (§3d.10, `?swap=<item_id>`) jestli katalog opravdu vrátil nabídku pro
 * ten řádek. Když ne, vrátí hotovou stavovou stránku s důvodem a cestou zpět.
 * Serverový modul (bez „use client") — volají ho jen serverové stránky.
 */
export async function resolvePickAccess(
  orderId: string,
  token: string | undefined,
  swapItemId: string | undefined
): Promise<
  | { ok: false; view: ReactElement }
  | {
      ok: true
      token: string
      orderNumber: number
      catalog: OrderEditCatalog
      swap: PickSwapInfo | null
    }
> {
  const [context, catalog] = token
    ? await Promise.all([
        getGuestOrderEditContext(orderId, token),
        getGuestOrderEditCatalog(orderId, token, swapItemId),
      ])
    : [null, null]

  if (!token || !context || !catalog) {
    return {
      ok: false,
      view: (
        <OrderStateShell
          eyebrow="Objednávka · úprava"
          kicker={swapItemId ? "Výměna v objednávce" : "Přidat k objednávce"}
          title="Odkaz nejde otevřít."
          description="Odkaz je neplatný nebo vypršel. Otevřete prosím úpravu objednávky z posledního e-mailu, nebo se nám ozvěte a vyřešíme to spolu."
          status="pending"
        />
      ),
    }
  }

  const back = { href: editPath(orderId, token), label: "Zpět na úpravu" }
  const blocked = (title: string, description: string) => ({
    ok: false as const,
    view: (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker={`Objednávka #${context.order.display_id}`}
        title={title}
        description={description}
        status="pending"
        primary={back}
      />
    ),
  })

  /* Čekající změna (platba rozdílu) blokuje každé další uložení — vybírat
     teď nemá smysl, ať to zákazník nezjistí až u souhrnu. */
  if (context.pending_change) {
    return blocked(
      swapItemId ? "Teď vyměnit nejde." : "Teď přidat nejde.",
      "K objednávce čeká úprava na zaplacení rozdílu. Dokončete ji, nebo ji na stránce úpravy zrušte — pak můžete pokračovat."
    )
  }

  // Server je soudce: `can_add` říká, jestli jde teď vybírat (přidání i výměna).
  if (!catalog.can_add) {
    return blocked(
      swapItemId ? "Teď vyměnit nejde." : "Teď přidat nejde.",
      catalog.reason ??
        context.reason ??
        "K téhle objednávce teď nic vybrat nejde. Kdybyste něco potřebovali, napište nám na info@keramickazahrada.cz."
    )
  }

  if (swapItemId) {
    /* Katalog bez nabídky pro řádek (zamčený, neexistující, nebo backend,
       který výměnu za jiný výrobek ještě nezná) — neukazovat obyčejné
       „přidat", to by vedlo k jiné akci, než zákazník chtěl. */
    if (catalog.purpose !== "swap" || !catalog.item) {
      return blocked(
        "Tuhle položku teď vyměnit nejde.",
        catalog.reason ??
          "Za jiný výrobek teď tuhle položku vyměnit nejde. Na stránce úpravy můžete vybrat jiné provedení, nebo nám napište na info@keramickazahrada.cz."
      )
    }
    return {
      ok: true,
      token,
      orderNumber: context.order.display_id,
      catalog,
      swap: {
        itemId: catalog.item.id,
        title: catalog.item.title,
        quantity: catalog.item.quantity,
        samePriceOnly: Boolean(catalog.same_price_only),
      },
    }
  }

  return {
    ok: true,
    token,
    orderNumber: context.order.display_id,
    catalog,
    swap: null,
  }
}
