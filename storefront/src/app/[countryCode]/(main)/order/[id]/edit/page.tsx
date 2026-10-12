import { getGuestOrderEditContext } from "@lib/data/guest-order-edit"
import { getOrderEditContext } from "@lib/data/order-edit"
import { retrieveCustomer } from "@lib/data/customer"
import { getCommissionBalance, listCommissionNotes } from "@lib/data/made-to-order"
import OrderEditor from "@modules/order/components/order-edit"
import OrderChangeOptions from "@modules/order/components/order-edit/change-options"
import {
  ORDER_EDIT_CONVERSATION_ID,
  ORDER_ITEM_EDITING_ENABLED,
} from "@modules/order/components/order-edit/shared"
import CommissionConversation from "@modules/order/components/commission-conversation"
import BalancePayPanel from "@modules/order/components/balance-pay"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { Metadata } from "next"
import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Úprava objednávky",
  description: "Upravte si svou objednávku.",
  // Stránka s osobním tokenem v adrese — do vyhledávače nepatří.
  robots: { index: false, follow: false },
}

/**
 * Úprava objednávky (plán §3c bod 9) — z e-mailového odkazu i z účtu.
 *
 * Jedna cesta pro oba: podepsaný token (`?token=`). Host ho má z e-mailu;
 * přihlášený zákazník bez tokenu si ho vyzvedne přes `getOrderEditContext`
 * (pole `access_token`, jen vlastníkovi) a stránka ho na tokenovou adresu
 * přesměruje — odkaz „Upravit objednávku" v účtu tak nemusí token znát.
 * Neplatný token = slušné vysvětlení, ne 404.
 *
 * 12. 10. 2026, Matěj: stránka nabízí jen změnu doručení a „Potřebuji změnit
 * objednávku" (`OrderChangeOptions`). Úprava položek s mini obchodem
 * (`OrderEditor`) zůstává v kódu za vypínačem `ORDER_ITEM_EDITING_ENABLED`
 * (vysvětlení u něj v `order-edit/shared.ts`).
 */
export default async function OrderEditPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  // „Moje objednávky" jen přihlášenému (host žádný výpis nemá).
  const customer = await retrieveCustomer().catch(() => null)
  const myOrdersAction = customer
    ? { href: "/account/orders", label: "Moje objednávky" }
    : undefined

  if (!token && customer) {
    const own = await getOrderEditContext(params.id)
    if (own?.access_token) {
      // Mimo try/catch: `redirect` hází řídicí výjimku, kterou Next zachytí sám.
      redirect(
        `/${params.countryCode}/order/${params.id}/edit?token=${encodeURIComponent(own.access_token)}`
      )
    }
  }

  const context = token
    ? await getGuestOrderEditContext(params.id, token)
    : null

  if (!token || !context) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker="Úprava objednávky"
        title="Odkaz nejde otevřít."
        description="Odkaz na úpravu je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte a upravíme to spolu."
        status="pending"
        primary={myOrdersAction}
      />
    )
  }

  // `null` = není zakázka → konverzace se nevykreslí. Čte přes publishable key,
  // takže funguje i hostovi z e-mailu (bez přihlášení).
  const [commissionNotes, commissionBalance] = await Promise.all([
    listCommissionNotes(params.id),
    // Doplatek zakázky (zbývá-li co doplatit) → panel s tlačítkem „Doplatit".
    getCommissionBalance(params.id),
  ])

  if (!ORDER_ITEM_EDITING_ENABLED) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker={`Objednávka #${context.order.display_id}`}
        title="Potřebujete něco změnit?"
        accent="Domluvíme se."
        description="Doručovací adresu nebo výdejní místo si změníte sami, dokud zásilku nepřipravíme k odeslání. Změny zboží domlouváme osobně — napište nám a Lucie vám zavolá nebo odepíše."
        status="pending"
        primary={myOrdersAction}
      >
        <OrderChangeOptions orderId={params.id} token={token} context={context} />
        <BalancePayPanel balance={commissionBalance} />
        {commissionNotes && (
          <div id={ORDER_EDIT_CONVERSATION_ID}>
            <CommissionConversation orderId={params.id} notes={commissionNotes} />
          </div>
        )}
      </OrderStateShell>
    )
  }

  /* ── Úprava položek s mini obchodem — vypnuto od 12. 10. 2026 ───────────
     Kód níž zůstává beze změny pro případ, že se vypínač zase zapne. */
  const description =
    context.mode === "swap_only"
      ? "Objednávka je zabalená — vyměnit jde už jen provedení za stejně drahé. Rozdíl ceny i to, co se stane s penězi, uvidíte ještě před uložením."
      : context.mode === "full" && context.items_editable
        ? "Změňte počet kusů, vyměňte provedení, odeberte nebo přidejte kus z obchodu. Rozdíl ceny i to, co se stane s penězi, uvidíte ještě před uložením."
        : "Co se s objednávkou dá ještě udělat, najdete níž. Kdybyste potřebovali víc, napište nám na info@keramickazahrada.cz."

  return (
    <OrderStateShell
      eyebrow="Objednávka · úprava"
      kicker={`Objednávka #${context.order.display_id}`}
      title="Upravte si objednávku."
      accent="Dokud ji nepošleme."
      description={description}
      status="pending"
      primary={myOrdersAction}
    >
      <OrderEditor
        orderId={params.id}
        token={token}
        context={context}
        hasConversation={Boolean(commissionNotes)}
      />
      <BalancePayPanel balance={commissionBalance} />
      {commissionNotes && (
        // Obal s id: zamčený zakázkový řádek odsud otevře konverzaci.
        <div id={ORDER_EDIT_CONVERSATION_ID}>
          <CommissionConversation orderId={params.id} notes={commissionNotes} />
        </div>
      )}
    </OrderStateShell>
  )
}
