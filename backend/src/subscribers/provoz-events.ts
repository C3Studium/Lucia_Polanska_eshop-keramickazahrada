import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { zapisProvoz, type DruhProvozu } from "../lib/provozni-hlidka/zapis"

/**
 * Doménové události do provozního deníku (3. 11. 2026).
 *
 * ## Proč vedle sběru z HTTP
 *
 * Sběr v `lib/provozni-hlidka/sber.ts` vidí požadavky — tedy to, co někdo
 * vyvolal zvenčí. Část nejdůležitější práce ale žádný požadavek nemá:
 * platbu zachytí notifikační URL brány, fakturu vystaví subscriber, zásilku
 * podá úloha. V deníku by pak byla vidět cesta „POST /hooks/payment", ale ne
 * to, co z ní vzniklo — a právě to je otázka, na kterou se u #68 nikdo
 * nedokázal odpovědět.
 *
 * Zapisuje se tedy obojí: požadavek i jeho následek. Je to schválně dvojí
 * záznam o jedné věci; souhrn je počítá po druzích, takže se nic nesčítá
 * dvakrát v tom, co je potřeba sledovat.
 *
 * ## Proč výčet, a ne všechno
 *
 * Událostí chodí stovky (každý zápis modelu). Tady stojí ty, které znamenají
 * „něco se v obchodě opravdu stalo" — zbytek by deník zavalil a to podstatné
 * schoval.
 */

const DRUHY: Record<string, { druh: DruhProvozu; popis: string }> = {
  "order.placed": { druh: "objednavka", popis: "objednávka přijata" },
  "order.canceled": { druh: "objednavka", popis: "objednávka zrušena" },
  "order.completed": { druh: "objednavka", popis: "objednávka dokončena" },
  "payment.captured": { druh: "platba", popis: "platba zachycena" },
  "payment.refunded": { druh: "platba", popis: "peníze vráceny" },
  "shipment.created": { druh: "objednavka", popis: "zásilka podána" },
  "customer.created": { druh: "prihlaseni", popis: "nový zákazník" },
  "auth.password_reset": { druh: "prihlaseni", popis: "obnova hesla" },
  "review.created": { druh: "obchod", popis: "nová recenze" },
  "product.created": { druh: "admin", popis: "nový výrobek" },
  "merchant-order.stage-changed": { druh: "zakazka", popis: "fáze zakázky" },
  "made-to-order.balance-paid": { druh: "zakazka", popis: "doplatek zaplacen" },
}

export default async function zapisProvozZUdalosti({
  event,
  container,
}: SubscriberArgs<{ id?: string }>) {
  const nazev = String(event.name ?? "")
  const popis = DRUHY[nazev]
  if (!popis) return

  const id = (event.data as { id?: string } | undefined)?.id

  await zapisProvoz(container, {
    druh: popis.druh,
    akce: nazev,
    stav: "ok",
    kdo: "systém",
    popis: popis.popis,
    ...(id ? { cehoSeTyka: { typ: nazev.split(".")[0], id } } : {}),
  })
}

export const config: SubscriberConfig = {
  event: Object.keys(DRUHY),
}
