'use client';

import { HttpTypes } from "@medusajs/types";

import { useMemo } from "react";
import OptionsSelect from "./Select/select";

type ColorsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
  isAdding?: boolean
  options: Record<string, string | undefined>
  setOptionValue: (optionId: string, value: string) => void
}

export default function Colors({
    product,
    disabled = false,
    isAdding,
    options = {},
    setOptionValue,
    
}: ColorsProps) {


    const colorOptions = useMemo(() => {
        if (!product.options) {
            return undefined
        }
        return (
            product.options?.find((o) => o.title.toLowerCase() === "barva") || 
            product.options?.find((o) => o.title.toLowerCase() === "color")
        )
    }, [product.options]);

    return (
        <div className="product__details__subDetails__colors" >
            { colorOptions && (<p>Barvy |</p>)}
            <div className="product__details__subDetails__colors__items">
                {(product.variants?.length ?? 0) > 1 && colorOptions && (
                    <div className="product__details__subDetails__colors__items__select">
                        <OptionsSelect 
                            key={colorOptions.id}
                            option={colorOptions}
                            current={options[colorOptions.id]}
                            updateOption={setOptionValue}
                            title={colorOptions.title ?? ""}
                            data-testid={`product-option-select-${colorOptions.id}`}
                            disabled={!!disabled || isAdding}
                        />
                    </div>
                )}
            </div> 
        </div>
    )
}

