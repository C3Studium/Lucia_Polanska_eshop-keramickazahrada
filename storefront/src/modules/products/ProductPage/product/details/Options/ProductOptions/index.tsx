"use client"

import { HttpTypes } from "@medusajs/types"

import ColorSelect from "../Colors/Select/select"
import SizeSelect from "../Sizes/Select/select"

type ProductOptionsProps = {
  product: HttpTypes.StoreProduct
  disabled?: boolean
  isAdding?: boolean
  options: Record<string, string | undefined>
  setOptionValue: (optionId: string, value: string) => void
}

/**
 * Renders **every** option a product declares.
 *
 * Previously only options literally titled `barva`/`color` and `velikost`/`size` rendered a
 * picker, so a product whose option was called "Glazura" or "Průměr" showed no control at all:
 * the variant could never be selected and the CTA sat dead on "Vyberte variantu" (spec §4,
 * trap 4). Naming is now only a *presentation hint* — it chooses which of the two existing
 * selects to use — and never decides whether an option is shown.
 */
export default function ProductOptions({
  product,
  disabled = false,
  isAdding,
  options = {},
  setOptionValue,
}: ProductOptionsProps) {
  const productOptions = product.options ?? []

  // A single variant means there is nothing to choose.
  if (!productOptions.length || (product.variants?.length ?? 0) <= 1) {
    return null
  }

  return (
    <>
      {productOptions.map((option) => {
        const Select = isSizeLike(option.title) ? SizeSelect : ColorSelect

        return (
          <div className="product__details__subDetails__colors" key={option.id}>
            <p>{labelFor(option.title)} |</p>
            <div className="product__details__subDetails__colors__items">
              <div className="product__details__subDetails__colors__items__select">
                <Select
                  option={option}
                  current={options[option.id]}
                  updateOption={setOptionValue}
                  title={option.title ?? ""}
                  data-testid={`product-option-select-${option.id}`}
                  disabled={!!disabled || isAdding}
                />
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

const SIZE_TITLES = ["velikost", "velikosti", "size", "sizes", "rozměr", "průměr"]
const COLOR_TITLES = ["barva", "barvy", "color", "colour", "glazura"]

const isSizeLike = (title?: string) =>
  SIZE_TITLES.includes((title ?? "").toLowerCase())

/** Keeps the two familiar Czech labels; anything else is shown under its own name. */
function labelFor(title?: string) {
  const normalised = (title ?? "").toLowerCase()

  if (COLOR_TITLES.slice(0, 4).includes(normalised)) return "Barvy"
  if (["velikost", "velikosti", "size", "sizes"].includes(normalised)) return "Velikosti"

  return title ?? "Provedení"
}
