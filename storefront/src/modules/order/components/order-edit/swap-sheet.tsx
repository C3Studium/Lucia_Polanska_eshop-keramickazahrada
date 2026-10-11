"use client"

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react"

import type { EditableItem, OrderEditMode } from "@lib/data/order-edit"
import { canSwapTo } from "@lib/util/order-edit-draft"

import { czk, signedCzk } from "./shared"
import s from "./style.module.scss"

/**
 * Výměna provedení — dlaždice variant s rozdílem ceny u každé.
 *
 * Na telefonu vyjíždí zespodu (palec je dole, seznam variant bývá delší než
 * výška obrazovky), na širším okně je to dialog uprostřed. Jeden výběr = hotovo:
 * klik na dlaždici změnu zapíše do návrhu a zavře se; klik na „Teď máte" výměnu
 * vrátí. Dialog z Headless UI drží fokus, Escape i zamčený scroll stránky.
 *
 * Zabalená objednávka (`swap_only`) nabízí jen dostupná provedení za stejnou
 * cenu — tak to pravidla chtějí a server by jiná odmítl.
 */
export default function SwapSheet({
  item,
  mode,
  chosenVariantId,
  quantityChanged,
  onChoose,
  onClose,
}: {
  /** Řádek, jehož provedení se mění; `null` = zavřeno. */
  item: EditableItem | null
  mode: OrderEditMode
  /** Varianta vybraná v návrhu (nebo původní). */
  chosenVariantId: string | null
  /** Řádek má v návrhu změněný počet — výměna ho nahradí (1 akce na řádek). */
  quantityChanged: boolean
  onChoose: (variantId: string) => void
  onClose: () => void
}) {
  const open = Boolean(item)

  const tiles = item
    ? item.variants.filter(
        (variant) =>
          variant.id === item.variant_id ||
          // Zabaleno: jiná než stejně drahá a dostupná provedení nenabízíme vůbec.
          mode !== "swap_only" ||
          canSwapTo(item, variant.id, mode)
      )
    : []

  return (
    <Dialog open={open} onClose={onClose} className={s.sheetRoot}>
      <DialogBackdrop className={s.sheetBackdrop} />
      <div className={s.sheetFrame}>
        {/* data-lenis-prevent: panel je vlastní scroll kontejner; bez toho by
            Lenis spolkl kolečko a rolovala by stránka pod dialogem. */}
        <DialogPanel className={s.sheet} data-lenis-prevent>
          {item && (
            <>
              <div className={s.sheetHead}>
                <DialogTitle className={s.sheetTitle}>
                  Vyměnit provedení
                </DialogTitle>
                <button
                  type="button"
                  className={s.sheetClose}
                  onClick={onClose}
                  aria-label="Zavřít"
                >
                  ×
                </button>
              </div>
              <p className={s.sheetLead}>
                {item.product_title || item.title} · {item.quantity} ks. Rozdíl
                ceny je za kus.
              </p>
              {mode === "swap_only" && (
                <p className={s.sheetNote}>
                  Objednávka je zabalená — nabízíme jen provedení za stejnou
                  cenu.
                </p>
              )}
              {quantityChanged && (
                <p className={s.sheetNote}>
                  Výměnou se zruší změna počtu kusů — vymění se původních{" "}
                  {item.quantity} ks.
                </p>
              )}

              {tiles.length > 1 ? (
                <ul className={s.tiles}>
                  {tiles.map((variant) => {
                    const current = variant.id === item.variant_id
                    const chosen = variant.id === (chosenVariantId ?? item.variant_id)
                    const selectable = current || canSwapTo(item, variant.id, mode)
                    const diff =
                      variant.price_czk === null
                        ? null
                        : variant.price_czk - item.unit_price
                    return (
                      <li key={variant.id}>
                        <button
                          type="button"
                          className={s.tile}
                          data-chosen={chosen || undefined}
                          disabled={!selectable}
                          aria-pressed={chosen}
                          onClick={() => onChoose(variant.id)}
                        >
                          <span className={s.tileTitle}>
                            {variant.title ?? "Provedení"}
                          </span>
                          <span className={s.tilePrice}>
                            {variant.price_czk === null
                              ? "Cena na dotaz"
                              : czk(variant.price_czk)}
                          </span>
                          <span
                            className={s.tileDiff}
                            data-tone={
                              diff === null || diff === 0
                                ? "same"
                                : diff > 0
                                  ? "up"
                                  : "down"
                            }
                          >
                            {current
                              ? "Teď máte"
                              : !variant.available
                                ? "Není skladem"
                                : diff === null
                                  ? "Rozdíl spočítáme"
                                  : diff === 0
                                    ? "Stejná cena"
                                    : signedCzk(diff)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className={s.sheetNote}>
                  Jiné provedení teď vybrat nejde. Kdybyste potřebovali něco
                  jiného, napište nám na info@keramickazahrada.cz.
                </p>
              )}
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
