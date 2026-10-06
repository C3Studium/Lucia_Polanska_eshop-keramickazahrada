"use client"

import { useMemo, useState, useTransition } from "react"
import {
  cancelOrderEdit,
  submitOrderEdit,
  type EditAction,
  type OrderEditContext,
} from "@lib/data/order-edit"
import {
  cancelGuestOrderEdit,
  submitGuestOrderEdit,
} from "@lib/data/guest-order-edit"
import styles from "./style.module.scss"

/**
 * Upravit objednávku — nejkratší poctivá cesta (Matěj, 2026-08-07):
 * u řádku vyberete jinou variantu nebo ho odeberete, dole vidíte rozdíl,
 * jedno tlačítko to uloží. Server je soudce — tlačítko jen předává.
 * Zakázkové řádky editor ukazuje zamčené s vysvětlením; poslední kus
 * odebrat nejde (úprava není zrušení).
 */
const czk = (value: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(value)

export default function OrderEdit({
  orderId,
  context,
  token,
}: {
  orderId: string
  context: OrderEditContext
  /**
   * Když je zadaný, editace jede přes hostovský endpoint s tímhle podepsaným
   * tokenem (odkaz z e-mailu, bez přihlášení). Bez něj jede zákaznická cesta
   * (přihlášený v účtu). Stejná komponenta, jen jiný dveřník.
   */
  token?: string
}) {
  const submit = (actions: EditAction[]) =>
    token
      ? submitGuestOrderEdit(orderId, actions, token)
      : submitOrderEdit(orderId, actions)
  const cancel = () =>
    token ? cancelGuestOrderEdit(orderId, token) : cancelOrderEdit(orderId)
  const [open, setOpen] = useState(false)
  const [swaps, setSwaps] = useState<Record<string, string>>({})
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Zabalená objednávka (K odeslání): jen výměna varianty za stejnou cenu —
  // žádné odebírání, v nabídce jen stejně drahé varianty. Server to i tak soudí.
  const swapOnly = Boolean(context.swap_only)

  const priceOf = (item: OrderEditContext["items"][number], variantId?: string) => {
    const chosen = variantId ?? item.variant_id ?? undefined
    const variant = item.variants.find((v) => v.id === chosen)
    return variant?.price_czk ?? item.unit_price
  }

  const actions: EditAction[] = useMemo(() => {
    const list: EditAction[] = []
    for (const [itemId, variantId] of Object.entries(swaps)) {
      if (removed.has(itemId)) continue
      const item = context.items.find((i) => i.id === itemId)
      if (item && variantId && variantId !== item.variant_id) {
        list.push({ type: "swap", item_id: itemId, variant_id: variantId })
      }
    }
    removed.forEach((itemId) => list.push({ type: "remove", item_id: itemId }))
    return list
  }, [swaps, removed, context.items])

  const difference = useMemo(() => {
    let delta = 0
    for (const action of actions) {
      const item = context.items.find((i) => i.id === (action as any).item_id)
      if (!item) continue
      if (action.type === "remove") delta -= item.unit_price * item.quantity
      if (action.type === "swap")
        delta += (priceOf(item, action.variant_id) - item.unit_price) * item.quantity
    }
    return Math.round(delta * 100) / 100
  }, [actions, context.items])

  const removableLeft =
    context.items.filter((i) => !removed.has(i.id)).length > 1

  if (context.pending_change) {
    return (
      <div className={styles.box}>
        <p className={styles.note}>
          Máte rozpracovanou úpravu čekající na zaplacení rozdílu. Dokončete ji
          z odkazu v e-mailu, nebo ji zrušte.
        </p>
        <button
          className={styles.secondary}
          onClick={() =>
            startTransition(async () => {
              await cancel()
              window.location.reload()
            })
          }
        >
          Zrušit rozpracovanou úpravu
        </button>
      </div>
    )
  }

  if (!context.editable) {
    return context.reason ? (
      <p className={styles.note}>{context.reason}</p>
    ) : null
  }

  if (!open) {
    return (
      <button className={styles.secondary} onClick={() => setOpen(true)}>
        Upravit objednávku
      </button>
    )
  }

  return (
    <div className={styles.box}>
      <h3 className={styles.title}>Úprava objednávky</h3>
      {swapOnly && (
        <p className={styles.note}>
          Objednávka je připravená k odeslání — vyměnit jde už jen varianta
          (třeba barva) za <strong>stejnou cenu</strong>. Větší změny vyřešíme po
          telefonu.
        </p>
      )}
      {context.items.map((item) => (
        <div key={item.id} className={styles.row}>
          <div className={styles.itemInfo}>
            <span className={removed.has(item.id) ? styles.struck : undefined}>
              {item.quantity}× {item.title}
            </span>
            {item.is_made_to_order && (
              <span className={styles.locked}>
                zakázka — pro změny nám prosím zavolejte
              </span>
            )}
          </div>
          {!item.is_made_to_order && !removed.has(item.id) && (() => {
            // V swap_only nabízíme jen varianty za stejnou cenu (+ tu aktuální);
            // jinak všechny, s rozdílem ceny v závorce.
            const variantOptions = swapOnly
              ? item.variants.filter(
                  (v) =>
                    v.price_czk === item.unit_price || v.id === item.variant_id
                )
              : item.variants
            return (
              <div className={styles.controls}>
                {variantOptions.length > 1 && (
                  <select
                    className={styles.select}
                    value={swaps[item.id] ?? item.variant_id ?? ""}
                    onChange={(e) =>
                      setSwaps((s) => ({ ...s, [item.id]: e.target.value }))
                    }
                  >
                    {variantOptions.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.title ?? "Varianta"}
                        {!swapOnly &&
                        variant.price_czk !== null &&
                        variant.price_czk !== item.unit_price
                          ? ` (${variant.price_czk > item.unit_price ? "+" : ""}${czk(variant.price_czk - item.unit_price)})`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
                {/* Odebrat jen při plné editaci — u zabalené objednávky ne. */}
                {!swapOnly && (
                  <button
                    className={styles.linklike}
                    disabled={!removableLeft}
                    title={
                      removableLeft
                        ? undefined
                        : "Poslední položka — úprava není zrušení objednávky."
                    }
                    onClick={() => setRemoved((r) => new Set(r).add(item.id))}
                  >
                    Odebrat
                  </button>
                )}
              </div>
            )
          })()}
          {removed.has(item.id) && (
            <button
              className={styles.linklike}
              onClick={() =>
                setRemoved((r) => {
                  const next = new Set(r)
                  next.delete(item.id)
                  return next
                })
              }
            >
              Vrátit zpět
            </button>
          )}
        </div>
      ))}

      <div className={styles.summary}>
        {actions.length === 0 ? (
          <span className={styles.note}>Zatím žádná změna.</span>
        ) : difference > 0 ? (
          <span>
            Rozdíl k doplacení: <strong>{czk(difference)}</strong>
            {context.payment !== "card" && " — vyrovná se při předání"}
          </span>
        ) : difference < 0 ? (
          <span>
            Vrátíme vám: <strong>{czk(-difference)}</strong>
            {context.payment !== "card" && " — vyrovná se při předání"}
          </span>
        ) : (
          <span>Beze změny ceny.</span>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {result && <p className={styles.note}>{result}</p>}

      <div className={styles.actions}>
        <button
          className={styles.primary}
          disabled={pending || actions.length === 0}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const outcome = await submit(actions)
              if ("error" in outcome) {
                setError(outcome.error)
                return
              }
              if (outcome.status === "awaiting_payment") {
                window.location.href = outcome.payment_url
                return
              }
              setResult(outcome.message)
              setTimeout(() => window.location.reload(), 1200)
            })
          }
        >
          {pending ? "Ukládám…" : "Uložit změny"}
        </button>
        <button className={styles.secondary} onClick={() => setOpen(false)}>
          Zavřít
        </button>
      </div>
    </div>
  )
}
