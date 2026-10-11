"use client"

import type { EditableItem, OrderEditMode } from "@lib/data/order-edit"
import {
  lineQuantityCap,
  type DraftAdd,
  type DraftLineChange,
} from "@lib/util/order-edit-draft"
import Thumbnail from "@modules/products/components/thumbnail"

import { czk } from "./shared"
import s from "./style.module.scss"

/** Věta k zamčenému řádku, kdyby ji server neposlal. */
const LOCK_FALLBACK: Record<NonNullable<EditableItem["lock"]>, string> = {
  made_to_order: "Zakázka — změny domluvíme v konverzaci k zakázce.",
  bundle: "Balíček se mění jen jako celek — napište nám.",
  clearance: "Poškozený kus je jediný — vyměnit ani přidat nejde.",
}

/**
 * − [n] + — počet kusů. Číslo se jen ukazuje (`output`), nepíše: strop je
 * sklad, a dvě tlačítka ho uhlídají bez validace psaného textu.
 */
function Stepper({
  label,
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max: number
  disabled?: boolean
  onChange: (next: number) => void
}) {
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Méně kusů"
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Více kusů"
      >
        +
      </button>
    </div>
  )
}

/**
 * Jeden řádek objednávky — na úzkém displeji karta, na širokém řádek tabulky
 * (přepíná kontejnerový dotaz v SCSS, ne JS).
 *
 * Co se tu ukazuje, je odhad: nová cena řádku podle ceny varianty / ceny za
 * kus. Skutečný rozdíl (se slevami a poštovným) spočítá server v souhrnu.
 */
export function EditItemRow({
  item,
  change,
  mode,
  editable,
  canRemove,
  canStartChange,
  hasConversation,
  onQuantity,
  onOpenSwap,
  onRemove,
  onRevert,
  onOpenConversation,
}: {
  item: EditableItem
  change: DraftLineChange | undefined
  mode: OrderEditMode
  /** Položky jdou upravovat (režim, limit, čekající změna, čistá zakázka). */
  editable: boolean
  /** Odebrání by nevyprázdnilo objednávku. */
  canRemove: boolean
  /** Novou změnu jde začít (strop 30 akcí). Rozdělaná změna jde měnit vždy. */
  canStartChange: boolean
  hasConversation: boolean
  onQuantity: (quantity: number) => void
  onOpenSwap: () => void
  onRemove: () => void
  onRevert: () => void
  onOpenConversation: () => void
}) {
  const name = item.product_title || item.title
  const locked = Boolean(item.lock)
  const removed = change?.type === "remove"
  /** Výměna za jiný výrobek z mini obchodu (§3d.10) — nese vlastní snímek. */
  const otherProduct = change?.type === "swap" ? change.product ?? null : null
  /** Výměna za jinou variantu téhož výrobku. */
  const swappedVariant =
    change?.type === "swap" && !otherProduct
      ? item.variants.find((variant) => variant.id === change.variant_id)
      : undefined
  const swapped = Boolean(otherProduct || swappedVariant)
  const swapLabel = otherProduct
    ? [otherProduct.title, otherProduct.variant_title].filter(Boolean).join(" · ")
    : swappedVariant?.title ?? "Jiné provedení"
  const quantity = change?.type === "set_quantity" ? change.quantity : item.quantity

  /* Cena za kus z toho, co objednávka skutečně účtovala (`total` může nést
     slevu), u výměny cena nové varianty / nového výrobku (snímek). */
  const paidUnit = item.quantity > 0 ? item.total / item.quantity : item.unit_price
  const unitNow = otherProduct
    ? otherProduct.unit_price ?? paidUnit
    : swappedVariant
      ? swappedVariant.price_czk ?? item.unit_price
      : paidUnit
  const totalNow = removed ? 0 : Math.round(unitNow * quantity)

  const interactive = editable && !locked && !removed
  const allowNew = canStartChange || Boolean(change)
  /* Vyměnit jde každý nezamčený řádek: když nemá jinou variantu, sheet aspoň
     nabídne výměnu za jiný výrobek (§3d.10) — i po zabalení, za stejnou cenu. */
  const showSwap = interactive
  const showRemove = interactive && mode === "full"
  const showStepper = interactive && mode === "full"

  const state = locked
    ? "locked"
    : removed
      ? "removed"
      : change
        ? "changed"
        : undefined

  return (
    <li className={s.row} data-state={state}>
      <span className={s.thumb}>
        <Thumbnail thumbnail={item.thumbnail} size="square" />
      </span>

      <div className={s.info}>
        <span className={s.name}>{name}</span>
        {(item.variant_title || swapped) && (
          <span className={s.chips}>
            {swapped ? (
              <>
                {item.variant_title && !otherProduct && (
                  <del className={s.chipOld}>{item.variant_title}</del>
                )}
                <span aria-hidden="true">→</span>
                <span className={s.chip} data-tone="new">
                  {otherProduct && <span className="sr-only">Vyměnit za </span>}
                  {swapLabel}
                </span>
              </>
            ) : (
              <span className={s.chip}>{item.variant_title}</span>
            )}
          </span>
        )}

        {locked && (
          <span className={s.lockReason}>
            {item.lock_reason || (item.lock ? LOCK_FALLBACK[item.lock] : "")}
            {item.lock === "made_to_order" && (
              <>
                {" "}
                {hasConversation ? (
                  <button
                    type="button"
                    className={s.textButton}
                    onClick={onOpenConversation}
                  >
                    Napsat k zakázce
                  </button>
                ) : (
                  <a className={s.textButton} href="mailto:info@keramickazahrada.cz">
                    Napsat nám
                  </a>
                )}
              </>
            )}
          </span>
        )}

        {/* Jedna změna na řádek (kontrakt) — počet a provedení najednou nejdou,
            tak to řádek řekne dřív, než se zákazník diví zamčenému stepperu. */}
        {swapped && mode === "full" && (
          <span className={s.rowNote}>
            Výměna platí pro {item.quantity} ks — počet a výměnu najednou
            změnit nejde.
          </span>
        )}
        {change?.type === "set_quantity" && (
          <span className={s.rowNote}>Původně {item.quantity} ks</span>
        )}
        {change && !removed && editable && (
          <button type="button" className={s.textButton} onClick={onRevert}>
            Vrátit zpět
          </button>
        )}
      </div>

      <div className={s.controls}>
        <div className={s.qty}>
          {showStepper ? (
            <Stepper
              label={`Počet kusů — ${name}`}
              value={quantity}
              max={lineQuantityCap(item)}
              disabled={swapped || !allowNew}
              onChange={onQuantity}
            />
          ) : (
            <span className={s.qtyStatic}>{quantity} ks</span>
          )}
        </div>

        <div className={s.actions}>
          {removed && editable && (
            <button type="button" className={s.pill} onClick={onRevert}>
              Vrátit zpět
            </button>
          )}
          {showSwap && (
            <button
              type="button"
              className={s.pill}
              onClick={onOpenSwap}
              disabled={!allowNew}
            >
              Vyměnit
            </button>
          )}
          {showRemove && (
            <button
              type="button"
              className={s.pill}
              data-tone="quiet"
              onClick={onRemove}
              disabled={!canRemove || !allowNew}
              title={
                canRemove
                  ? undefined
                  : "Poslední položka — úprava není zrušení objednávky."
              }
            >
              Odebrat
            </button>
          )}
        </div>
      </div>

      <div className={s.price}>
        {(change || removed) && <del>{czk(item.total)}</del>}
        {!removed && <strong>{czk(totalNow)}</strong>}
        {!removed && quantity > 1 && (
          <span className={s.unit}>{czk(Math.round(unitNow))}/ks</span>
        )}
      </div>
    </li>
  )
}

/**
 * Kus přidaný z mini obchodu (zatím jen v návrhu). Cena je snímek z chvíle
 * výběru; kolik to doopravdy dělá, řekne souhrn ze serveru.
 */
export function AddedItemRow({
  add,
  canRemove,
  onQuantity,
  onRemove,
}: {
  add: DraftAdd
  canRemove: boolean
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  return (
    <li className={s.row} data-state="added">
      <span className={s.thumb}>
        <Thumbnail thumbnail={add.thumbnail} size="square" />
      </span>

      <div className={s.info}>
        <span className={s.name}>{add.title}</span>
        <span className={s.chips}>
          {add.variant_title && <span className={s.chip}>{add.variant_title}</span>}
          <span className={s.chip} data-tone="new">
            Nově přidáno
          </span>
        </span>
      </div>

      <div className={s.controls}>
        <div className={s.qty}>
          <Stepper
            label={`Počet kusů — ${add.title}`}
            value={add.quantity}
            max={add.max_quantity}
            onChange={onQuantity}
          />
        </div>
        <div className={s.actions}>
          <button
            type="button"
            className={s.pill}
            data-tone="quiet"
            onClick={onRemove}
            disabled={!canRemove}
            title={
              canRemove
                ? undefined
                : "Poslední položka — úprava není zrušení objednávky."
            }
          >
            Odebrat
          </button>
        </div>
      </div>

      <div className={s.price}>
        {add.unit_price !== null ? (
          <>
            <strong>{czk(Math.round(add.unit_price * add.quantity))}</strong>
            {add.quantity > 1 && (
              <span className={s.unit}>{czk(add.unit_price)}/ks</span>
            )}
          </>
        ) : (
          <span className={s.unit}>Cena v souhrnu</span>
        )}
      </div>
    </li>
  )
}
