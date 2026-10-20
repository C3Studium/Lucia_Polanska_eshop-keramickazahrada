import { retrieveOrder, getOrderAccessToken } from "@lib/data/orders"
import { getOrderClaims } from "@lib/data/claims"
import OrderDetailsTemplate from "@modules/order/templates/order-details-template"
import { CLAIM_FORM_KEY } from "@modules/order/components/carrier-damage"
import { getSiteDocument } from "@lib/data/documents"
import { getOrderEditContext } from "@lib/data/order-edit"
import { ORDER_ITEM_EDITING_ENABLED } from "@modules/order/components/order-edit/shared"
import {
  getCommissionBalance,
  getCommissionCancellation,
  listCommissionNotes,
  listCommissionNotesByCommission,
} from "@lib/data/made-to-order"
import { getOrderProgress } from "@lib/data/order-progress"
import { orderTermsRef } from "@lib/legal/order-terms"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  return {
    title: `Objednávka #${order.display_id}`,
    description: "Detail objednávky — co jste objednali, doprava i platba.",
  }
}

export default async function OrderDetailPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  /* Úprava objednávky má vlastní stránku (`/order/:id/edit`, stejná jako
     z e-mailu); tady se jen nabídne odkaz, když je co upravit nebo dokončit.
     Stránka úpravy si za přihlášeného token vyzvedne sama. */
  const editContext = await getOrderEditContext(order.id)
  // 12. 10. 2026, Matěj: bez úpravy položek nabízí stránka změnu doručení
  // a žádost o změnu — obojí jde, dokud objednávka není vypravená
  // (`mode !== "none"`); limit úprav položek tu už nehraje roli.
  const canOpenEdit = ORDER_ITEM_EDITING_ENABLED
    ? editContext?.editable
    : editContext?.mode !== "none"
  const edit =
    editContext && (canOpenEdit || editContext.pending_change)
      ? {
          mode: editContext.mode,
          pending: Boolean(editContext.pending_change),
        }
      : null
  // Načítá se tady, protože tahle stránka je serverová — šablona pod ní
  // je klientská a datová vrstva `server-only`.
  const claimForm = await getSiteDocument(CLAIM_FORM_KEY)
  // `null` = není zakázka (route 404) → konverzace se nevykreslí; prázdné pole
  // = zakázka, kde se zatím nepsalo, a ta tlačítko mít má.
  const commissionNotes = await listCommissionNotes(order.id)
  // Doplatek zakázky (zbývá-li co doplatit) → panel s tlačítkem „Doplatit".
  const commissionBalance = await getCommissionBalance(order.id)
  // Reklamace / vrácení jede přes podepsaný token (stejně jako z e-mailu a z
  // potvrzení) — tady ho získáme za přihlášeného. `null` → formulář se nenabídne.
  const selfServiceToken = await getOrderAccessToken(order.id)
  const claims = selfServiceToken
    ? await getOrderClaims(order.id, selfServiceToken)
    : null
  // Zrušení zakázky (audit § 0, Z4/Z5) — fázi a částky říká backend; jen u
  // zakázky, jinak se neptáme.
  const commissionCancellation = commissionBalance?.is_commission
    ? await getCommissionCancellation(order.id, selfServiceToken)
    : null
  // Z-A: u víc zakázek vlákno konverzace per zakázka (jinak null → vlákno objednávky).
  const commissionNotesById = await listCommissionNotesByCommission(
    order.id,
    commissionBalance
  )
  // Stav objednávky ze serveru (reklamace, odesláno, výroba zakázky…) —
  // samotný `fulfillment_status` o Denní práci ani reklamacích neví.
  const progress = await getOrderProgress(order.id, selfServiceToken)
  // Znění OP k objednávce (archiv smlouvy, OP čl. III a IV) — z registru,
  // který smí jen server; šabloně jde malý objekt.
  const terms = await orderTermsRef(order)

  return (
    <OrderDetailsTemplate
      order={order}
      claimForm={claimForm}
      commissionNotes={commissionNotes}
      commissionBalance={commissionBalance}
      commissionCancellation={commissionCancellation}
      commissionNotesById={commissionNotesById}
      selfServiceToken={selfServiceToken}
      claims={claims}
      edit={edit}
      statusLabel={progress?.status?.label || progress?.stage_label || null}
      terms={terms}
    />
  )
}
