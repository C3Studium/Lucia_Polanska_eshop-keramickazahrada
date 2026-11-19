import RefreshWhilePaying from "@modules/common/components/refresh-while-paying"
import { commissionsOf } from "@lib/util/made-to-order"
import { retrieveOrder, getOrderAccessToken } from "@lib/data/orders"
import { getOrderClaims } from "@lib/data/claims"
import { getOrderDocuments } from "@lib/data/order-documents"
import { fallbackStageLabel, getOrderProgress } from "@lib/data/order-progress"
import {
  getCommissionBalance,
  getCommissionCancellation,
  listCommissionNotes,
  listCommissionNotesByCommission,
  reconcileOrderBalance,
} from "@lib/data/made-to-order"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import BalancePaymentNotice from "@modules/order/components/balance-payment-notice"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { getPageCopy } from "@lib/data/site-copy"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ platba?: string }>
}

export const metadata: Metadata = {
  title: "Objednávka potvrzena",
  description: "Objednávku máme, děkujeme.",
}

/*
 * Stav zakázky hned po zaplacení (16. 11. 2026, objednávka #77).
 *
 * Výrobní objednávku i záznam „záloha zaplacena" zakládá backend až chvilku
 * po vzniku objednávky (subscriber, u #77 o 0,3 s později). Potvrzení se ale
 * otevírá hned po bráně, takže se ptalo dřív: zbývající částka vyšla jako
 * celá cena (6 060 místo 3 375), tlačítko chtělo doplatit všechno a panel
 * zakázky sliboval vrátit „0,-". Když je objednávka zaplacená a obsahuje
 * zakázku, ale backend platbu ještě nezapsal, chvilku počkáme a zeptáme se
 * znovu (nejvýš ~3 s). U běžné objednávky se nečeká vůbec.
 */
const settledCommissionBalance = async (orderId: string, order: any) => {
  const hasCommissionLine = ((order?.items ?? []) as any[]).some(
    (item) => item?.metadata?.made_to_order
  )
  const paidNow = ((order?.payment_collections ?? []) as any[])
    .flatMap((collection) => collection?.payments ?? [])
    .reduce((sum: number, payment: any) => sum + (Number(payment?.amount) || 0), 0)
  let balance = await getCommissionBalance(orderId)
  if (!hasCommissionLine || paidNow <= 0.005) return balance
  const recorded = (value: typeof balance) =>
    Boolean(value?.is_commission) &&
    ((value as any)?.totals?.deposit_paid ?? (value as any)?.deposit_paid ?? 0) +
      ((value as any)?.totals?.balance_paid ?? (value as any)?.balance_paid ?? 0) >
      0.005
  // Po 150 ms, nejvýš ~3 s: zápis trvá obvykle ~0,3 s, takže stačí 2–3 dotazy.
  for (let attempt = 0; attempt < 20 && !recorded(balance); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    balance = await getCommissionBalance(orderId)
  }
  return balance
}

export default async function OrderConfirmedPage(props: Props) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const outcome = searchParams.platba

  /*
   * Dorovnat doplatek při KAŽDÉM otevření potvrzení, ne jen po návratu z brány
   * (`?platba`). Doplatek nemá vlastní „dokončovací" krok jako záloha v
   * checkoutu; webhook potřebuje notif. URL v portálu a job běží po 30 min —
   * bez tohohle mohl zaplacený doplatek viset „nedorovnaný", dokud někdo
   * nedoběhl. reconcileOrderBalance je idempotentní a zkratuje, když není
   * otevřený doplatek (jen pár dotazů do DB), takže běžné načtení skoro nic
   * nestojí; u otevřeného doplatku se zeptá brány a při zaplacení HNED srovná
   * (označí zaplaceno, zaúčtuje, pošle potvrzení + fakturu). Pozdní webhook/job
   * to pak nezdvojí (onBalancePaid dedupuje).
   */
  /*
   * Rychlost (16. 11. 2026): dotazy šly jeden po druhém (~10 za sebou).
   * Teď ve třech kolech — co na sobě nezávisí, běží souběžně:
   *  1. dorovnání doplatku + podepsaný token + texty stránky,
   *  2. objednávka (až po dorovnání, ať nese čerstvý stav platby),
   *  3. stav, zakázka, deník a reklamace najednou; pak jen to, co potřebuje
   *     výsledek zakázky.
   */
  const [, tokenOrNull, copy] = await Promise.all([
    reconcileOrderBalance(params.id).catch(() => null),
    // Podepsaný token pro „Upravit / Zrušit / Reklamace" rovnou odtud (stránky
    // jinak chtějí token z e-mailu) — a stejným tokenem i stav objednávky pro
    // hosta bez přihlášení. `null` → tlačítka se nevykreslí.
    getOrderAccessToken(params.id).catch(() => null),
    // Poděkování a okénko „Potřebujete s něčím pomoct?" — bloky na stránce
    // `kosik` (konec nákupu). Výpadek CMS = texty z kódu.
    getPageCopy("kosik"),
  ])

  const order = await retrieveOrder(params.id).catch(() => null)
  const selfServiceToken = order ? tokenOrNull : null

  /*
   * The zakázka's diary. The route 404s for an order that is not a commission, and the fetcher
   * turns that into an empty list — so `null` here means "not a zakázka, draw nothing" while an
   * empty array means "a zakázka with nothing said yet", which still deserves the box.
   */
  // Stav doplatku zakázky (zaplaceno zálohou / zbývá / odkaz na doplacení) —
  // Souhrn z toho pozná „jen záloha" a nabídne tlačítko doplatit. Napřed,
  // protože počká, až backend zálohu zapíše (viz `settledCommissionBalance`).
  const [progress, commissionBalance, commissionNotes, claims, documents] = await Promise.all([
    // Stav objednávky (reklamace, odesláno, výroba…). Null jen když selže.
    order ? getOrderProgress(params.id, selfServiceToken) : null,
    order ? settledCommissionBalance(params.id, order) : null,
    order ? listCommissionNotes(params.id) : null,
    // Reklamace a vrácení k objednávce (+ zda jde ještě odstoupit) — stejným
    // tokenem. `null` = nepovedlo se načíst → sekce se nevykreslí a tlačítka
    // zůstanou jako dřív (pravidla pohlídá stránka formuláře).
    selfServiceToken ? getOrderClaims(params.id, selfServiceToken) : null,
    // Dokumenty ke stažení (potvrzení, faktura, podmínky…) — stejným tokenem.
    order ? getOrderDocuments(params.id, selfServiceToken) : null,
  ])
  const [commissionCancellation, commissionNotesById] = await Promise.all([
    // Zrušení zakázky (audit § 0, Z4/Z5) — jen u zakázky, tokenem hosta.
    commissionBalance?.is_commission
      ? getCommissionCancellation(params.id, selfServiceToken)
      : null,
    // Z-A: u víc zakázek vlákno konverzace per zakázka (jinak null → vlákno objednávky).
    listCommissionNotesByCommission(params.id, commissionBalance),
  ])

  /*
   * The backend redirects here after a balance payment (§4.6). That link is e-mailed, so it is
   * often opened by a guest or in a browser with no session — and then the order cannot be
   * loaded. Showing a 404 to someone who has just paid reads as "it did not work", and the
   * usual response to that is paying twice. The acknowledgement comes first; the order detail
   * is a bonus when we can load it.
   */
  if (!order) {
    if (outcome) {
      return (
        <OrderStateShell
          eyebrow="Platba"
          title="Máme to."
          accent="Objednávka je v pořádku."
          description="Podrobnosti se nám tu nepovedlo načíst. Najdete je v e-mailu s potvrzením, nebo ve svém účtu."
          status={outcome === "paid" ? "success" : "pending"}
          primary={{ href: "/account/orders", label: "Moje objednávky" }}
        >
          <BalancePaymentNotice outcome={outcome} inline />
        </OrderStateShell>
      )
    }

    return notFound()
  }

  /* Návrat z brány s otevřeným doplatkem → stránka se sama obnovuje (každé
     načtení se zeptá brány, viz reconcileOrderBalance výš), dokud nedoběhne. */
  const balanceOpen = commissionsOf(commissionBalance).some((c) => (c.outstanding ?? 0) > 0)

  return (
    <>
      {outcome && outcome !== "zruseno" && balanceOpen ? <RefreshWhilePaying /> : null}
      <BalancePaymentNotice outcome={outcome} />
      <OrderCompletedTemplate
        copy={copy}
        order={order}
        progress={progress}
        progressFallback={fallbackStageLabel(order)}
        commissionNotes={commissionNotes}
        commissionBalance={commissionBalance}
        commissionCancellation={commissionCancellation}
        commissionNotesById={commissionNotesById}
        selfServiceToken={selfServiceToken}
        claims={claims}
        documents={documents}
      />
    </>
  )
}
