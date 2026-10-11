"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react"

import {
  cancelGuestOrderEdit,
  submitGuestOrderEdit,
} from "@lib/data/guest-order-edit"
import type { EditableItem, OrderEditContext } from "@lib/data/order-edit"
import {
  MAX_EDIT_ACTIONS,
  canSwapTo,
  clearDraft,
  draftActionCount,
  draftToActions,
  emptyDraft,
  lineQuantityCap,
  readDraft,
  sanitizeDraft,
  writeDraft,
  type DraftLineChange,
  type OrderEditDraft,
} from "@lib/util/order-edit-draft"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import OrderDeliverySection from "./delivery-section"
import EditSummary, { type EditConfirmation } from "./edit-summary"
import { AddedItemRow, EditItemRow } from "./item-row"
import {
  ORDER_EDIT_CONVERSATION_ID,
  claimsPath,
  itemsLabel,
  pickShopPath,
  refundPath,
  remainingEditsLabel,
} from "./shared"
import SwapSheet from "./swap-sheet"
import { useEditPreview } from "./use-edit-preview"
import s from "./style.module.scss"

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(min, Math.floor(value)), Math.max(min, max))

/**
 * Stránka „Upravit objednávku" (plán §3c bod 9) — stavová lišta, položky se
 * stepperem a výměnou, přidání z mini obchodu, doručení a přilepený souhrn
 * s jedním tlačítkem.
 *
 * Server je soudce. UI pravidla jen předjímá, aby zákazník nenaklikal něco,
 * co neprojde (zamčené řádky, prázdná objednávka, 1 změna na řádek, strop 30
 * akcí), a o penězích neříká nic, co neřekl server v náhledu (`dry_run`).
 *
 * Rozpracované změny drží návrh (`OrderEditDraft`) ve stavu i v
 * `sessionStorage` — přežijí cestu do mini obchodu a zpět.
 */
export default function OrderEditor({
  orderId,
  token,
  context,
  hasConversation,
}: {
  orderId: string
  token: string
  context: OrderEditContext
  /** Na stránce je konverzace k zakázce — zamčený zakázkový řádek ji otevře. */
  hasConversation: boolean
}) {
  const router = useRouter()
  const headingId = useId()
  const { mode, items } = context

  /** Jdou teď upravovat položky? Čekající změna (platba) blokuje další. */
  const itemsEditable =
    context.editable &&
    context.items_editable &&
    mode !== "none" &&
    !context.pending_change

  const [draft, setDraft] = useState<OrderEditDraft>(emptyDraft)
  /** Návrh se načte ze `sessionStorage` až po připojení (na serveru není) —
      do té doby se nesmí nic zapisovat, jinak by prázdný stav návrh smazal. */
  const [loaded, setLoaded] = useState(false)
  const [swapItemId, setSwapItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<EditConfirmation | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [cancelling, startCancel] = useTransition()

  /* Načtení a srovnání návrhu s kontextem. Při čekající změně se návrh
     nenačítá ani nepřepisuje — po jejím zrušení se vrátí, jak byl. Při každém
     novém kontextu (uložené doručení, zabalená objednávka) se srovná znovu. */
  useEffect(() => {
    if (!itemsEditable) return
    if (!loaded) {
      setDraft(sanitizeDraft(readDraft(orderId), context))
      setLoaded(true)
    } else {
      setDraft((current) => sanitizeDraft(current, context))
    }
    // `loaded` záměrně ne: přepnutí na true by srovnání jen zopakovalo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, itemsEditable, context])

  useEffect(() => {
    if (loaded) writeDraft(orderId, draft)
  }, [loaded, orderId, draft])

  const actions = useMemo(() => draftToActions(draft), [draft])
  const actionCount = draftActionCount(draft)
  const atLimit = actionCount >= MAX_EDIT_ACTIONS

  /* Otisk objednávky pro náhled: změna výdejny může změnit poštovné, takže se
     tentýž návrh musí spočítat znovu. */
  const stamp = [
    context.order.total,
    context.order.shipping_total,
    context.delivery?.method,
    context.delivery?.pickup_point?.id ?? "",
    context.delivery?.shipping_address?.postal_code ?? "",
  ].join("|")

  const preview = useEditPreview({
    orderId,
    token,
    actions,
    stamp,
    enabled: itemsEditable && loaded && !paymentUrl,
  })

  /* Kolik kusů (řádků) v objednávce zůstane — zamčené se počítají taky: i ty
     objednávku drží neprázdnou. Přidané kusy z návrhu taky. */
  const remainingLines =
    items.filter((item) => draft.lines[item.id]?.type !== "remove").length +
    draft.adds.length
  const canRemoveOne = remainingLines > 1

  const touch = () => {
    setConfirmation(null)
    setSubmitError(null)
  }

  const setLine = useCallback(
    (itemId: string, change: DraftLineChange | null) => {
      setDraft((current) => {
        const isNew = !current.lines[itemId]
        if (change && isNew && draftActionCount(current) >= MAX_EDIT_ACTIONS) {
          return current
        }
        const lines = { ...current.lines }
        if (change) lines[itemId] = change
        else delete lines[itemId]
        return { ...current, lines }
      })
    },
    []
  )

  const changeQuantity = (item: EditableItem, next: number) => {
    touch()
    const quantity = clamp(next, 1, lineQuantityCap(item))
    setLine(
      item.id,
      quantity === item.quantity ? null : { type: "set_quantity", quantity }
    )
  }

  const chooseVariant = (item: EditableItem, variantId: string) => {
    touch()
    if (variantId === item.variant_id) {
      // „Teď máte" vrací jen výměnu — změnu počtu na řádku nechá být.
      if (draft.lines[item.id]?.type === "swap") setLine(item.id, null)
    } else if (canSwapTo(item, variantId, mode)) {
      setLine(item.id, { type: "swap", variant_id: variantId })
    }
    setSwapItemId(null)
  }

  const removeItem = (item: EditableItem) => {
    if (!canRemoveOne) return
    touch()
    setLine(item.id, { type: "remove" })
  }

  const revertItem = (item: EditableItem) => {
    touch()
    setLine(item.id, null)
  }

  const changeAddQuantity = (variantId: string, next: number) => {
    touch()
    setDraft((current) => ({
      ...current,
      adds: current.adds.map((add) =>
        add.variant_id === variantId
          ? { ...add, quantity: clamp(next, 1, add.max_quantity) }
          : add
      ),
    }))
  }

  const dropAdd = (variantId: string) => {
    if (!canRemoveOne) return
    touch()
    setDraft((current) => ({
      ...current,
      adds: current.adds.filter((add) => add.variant_id !== variantId),
    }))
  }

  /* Zamčený zakázkový řádek → otevřít konverzaci k zakázce, která na stránce
     stojí pod úpravou (její tlačítko otevře popup s vláknem). */
  const openConversation = () => {
    document
      .getElementById(ORDER_EDIT_CONVERSATION_ID)
      ?.querySelector<HTMLButtonElement>("button")
      ?.click()
  }

  const save = async () => {
    if (!preview.current || saving) return
    setSaving(true)
    setSubmitError(null)
    const result = await submitGuestOrderEdit(orderId, actions, token)
    if ("error" in result) {
      setSaving(false)
      setSubmitError(result.error)
      return
    }

    // Uloženo (nebo čeká na platbu) — návrh splnil svou roli.
    clearDraft(orderId)
    setDraft(emptyDraft())

    if (result.status === "awaiting_payment") {
      /* Odchod na platební bránu. Stránka se mezitím ze serveru překreslí
         s „čeká na zaplacení" — `paymentUrl` drží místo toho hlášku
         o přesměrování, ať to neblikne. */
      setPaymentUrl(result.payment_url)
      window.location.assign(result.payment_url)
      return
    }

    setSaving(false)
    setConfirmation({
      message: result.message,
      claimsHref: result.claim_request_id ? claimsPath(orderId, token) : null,
    })
    // Akce už stránky zneplatnila; refresh dotáhne nový kontext (položky,
    // součty, zbývající úpravy) i tam, kde by odpověď akce nestačila.
    router.refresh()
  }

  const cancelPending = () =>
    startCancel(async () => {
      await cancelGuestOrderEdit(orderId, token)
      router.refresh()
    })

  if (paymentUrl) {
    return (
      <div className={s.root}>
        <div className={s.notice} role="status">
          <p className={s.noticeTitle}>Přesměrováváme vás na platbu rozdílu…</p>
          <p className={s.noticeText}>
            Když se nic neděje,{" "}
            <a className={s.textButton} href={paymentUrl}>
              pokračujte na platbu tady
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  /* ─── Stavová lišta ─────────────────────────────────────────────────── */
  const statusTone =
    !context.editable || mode === "none" || !context.items_editable
      ? "closed"
      : mode === "swap_only"
        ? "packed"
        : "open"
  const statusText =
    statusTone === "closed"
      ? context.reason ??
        "Tuhle objednávku už upravit nejde. Kdybyste něco potřebovali, napište nám na info@keramickazahrada.cz."
      : statusTone === "packed"
        ? "Zabaleno — vyměnit jde jen varianta za stejnou cenu."
        : "Upravit můžete, dokud nezačneme balit."
  const showRemaining =
    context.editable && context.edits.limit > 0 && context.edits.remaining > 0

  const deliveryMethod = context.delivery?.method
  const showDelivery =
    context.editable &&
    Boolean(context.delivery) &&
    (deliveryMethod === "balikovna" || deliveryMethod === "home")

  const swapItem = swapItemId
    ? items.find((item) => item.id === swapItemId) ?? null
    : null
  const swapChange = swapItem ? draft.lines[swapItem.id] : undefined

  return (
    <div className={s.root}>
      <div className={s.status} data-tone={statusTone} role="status">
        <p className={s.statusText}>{statusText}</p>
        {showRemaining && (
          <span className={s.statusMeta}>
            {remainingEditsLabel(context.edits.remaining)}
          </span>
        )}
      </div>

      {context.pending_change && (
        <div className={s.notice} data-tone="pending">
          <p className={s.noticeTitle}>
            {context.pending_change.awaiting_payment
              ? "Čeká na zaplacení rozdílu"
              : "Rozpracovaná úprava"}
          </p>
          <p className={s.noticeText}>
            {context.pending_change.awaiting_payment
              ? "Úpravu jste uložili, ale rozdíl ještě není zaplacený — do té doby objednávka zůstává, jak byla. Když platbu nedokončíte, úpravu zrušte a můžete ji udělat znovu."
              : "K objednávce běží nedokončená úprava. Když ji nechcete dokončit, zrušte ji a můžete začít znovu."}
          </p>
          <button
            type="button"
            className={s.pill}
            onClick={cancelPending}
            disabled={cancelling}
          >
            {cancelling ? "Rušíme…" : "Zrušit rozpracovanou úpravu"}
          </button>
        </div>
      )}

      <section className={s.section} aria-labelledby={`${headingId}-items`}>
        <header className={s.sectionHead}>
          <h2 id={`${headingId}-items`} className={s.sectionTitle}>
            Položky
          </h2>
          <span className={s.sectionMeta}>{itemsLabel(items.length)}</span>
        </header>

        {/* Hlavička sloupců jen pro oko — na širokém kontejneru je seznam
            tabulkou, na úzkém kartami (viz SCSS); odečítač čte řádky. */}
        <div className={s.tableHead} aria-hidden="true">
          <span>Položka</span>
          <span>Počet</span>
          <span>Cena</span>
          <span />
        </div>

        <ul className={s.items}>
          {items.map((item) => (
            <EditItemRow
              key={item.id}
              item={item}
              change={draft.lines[item.id]}
              mode={mode}
              editable={itemsEditable && loaded}
              canRemove={canRemoveOne}
              canStartChange={!atLimit}
              hasConversation={hasConversation}
              onQuantity={(quantity) => changeQuantity(item, quantity)}
              onOpenSwap={() => setSwapItemId(item.id)}
              onRemove={() => removeItem(item)}
              onRevert={() => revertItem(item)}
              onOpenConversation={openConversation}
            />
          ))}
        </ul>

        {itemsEditable && mode === "full" && !canRemoveOne && (
          <p className={s.hint}>
            Úprava není zrušení — poslední kus odebrat nejde. Zrušit objednávku
            můžete přes{" "}
            <LocalizedClientLink
              className={s.textButton}
              href={refundPath(orderId, token)}
            >
              Reklamace a zrušení
            </LocalizedClientLink>
            .
          </p>
        )}
      </section>

      {itemsEditable && context.can_add && (
        <section className={s.section} aria-labelledby={`${headingId}-add`}>
          <header className={s.sectionHead}>
            <h2 id={`${headingId}-add`} className={s.sectionTitle}>
              Přidat k objednávce
            </h2>
          </header>
          <p className={s.sectionLead}>
            Vyberte cokoli z obchodu — pošleme to spolu s objednávkou.
            {context.payment === "dobirka" &&
              " U dobírky nabízíme jen kusy, které jde poslat na dobírku."}
          </p>

          {draft.adds.length > 0 && (
            <ul className={s.items}>
              {draft.adds.map((add) => (
                <AddedItemRow
                  key={add.variant_id}
                  add={add}
                  canRemove={canRemoveOne}
                  onQuantity={(quantity) => changeAddQuantity(add.variant_id, quantity)}
                  onRemove={() => dropAdd(add.variant_id)}
                />
              ))}
            </ul>
          )}

          {atLimit ? (
            <p className={s.hint}>
              Víc změn najednou uložit nejde — nejdřív uložte tyhle.
            </p>
          ) : (
            <LocalizedClientLink
              className={s.addLink}
              href={pickShopPath(orderId, token)}
            >
              <span>{draft.adds.length ? "Přidat další kus" : "Vybrat z obchodu"}</span>
              <i aria-hidden="true">→</i>
            </LocalizedClientLink>
          )}
        </section>
      )}

      {showDelivery && context.delivery && (
        <OrderDeliverySection
          orderId={orderId}
          token={token}
          delivery={context.delivery}
          paysByDobirka={context.payment === "dobirka"}
        />
      )}

      {itemsEditable && loaded && (
        <EditSummary
          actionsCount={actions.length}
          state={preview.state}
          current={preview.current}
          last={preview.last}
          saving={saving}
          submitError={submitError}
          atLimit={atLimit}
          confirmation={confirmation}
          onSave={save}
          onDismissConfirmation={() => setConfirmation(null)}
        />
      )}
      {/* Po uložení může úprava skončit (limit) — potvrzení se ukáže i tak. */}
      {!itemsEditable && confirmation && (
        <EditSummary
          actionsCount={0}
          state={{ status: "idle" }}
          current={null}
          last={null}
          saving={false}
          submitError={null}
          atLimit={false}
          confirmation={confirmation}
          onSave={save}
          onDismissConfirmation={() => setConfirmation(null)}
        />
      )}

      <SwapSheet
        item={swapItem}
        mode={mode}
        chosenVariantId={
          swapChange?.type === "swap" ? swapChange.variant_id : swapItem?.variant_id ?? null
        }
        quantityChanged={swapChange?.type === "set_quantity"}
        onChoose={(variantId) => swapItem && chooseVariant(swapItem, variantId)}
        onClose={() => setSwapItemId(null)}
      />
    </div>
  )
}
