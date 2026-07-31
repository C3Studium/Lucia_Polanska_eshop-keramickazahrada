"use client"

import { HttpTypes } from "@medusajs/types"

import { useRef, useState } from "react"
import styles from "./select.module.scss"
import OptionButton from "@modules/common/components/Buttons/optionButton"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (optionId: string, value: string) => void
  title: string
  disabled: boolean | undefined
  "data-testid"?: string
}


const OptionsSelect: React.FC<OptionSelectProps> = ({
    option,
    current,
    updateOption,
    title,
    "data-testid": dataTestId,
    disabled,
}) => {
    const filteredOptions = (option.values ?? []).map((v) => v.value)
    const [hoveredValue, setHoveredValue] = useState<string | null>(null)
    const [direction, setDirection] = useState<1 | -1>(1)
    const lastHoveredIndex = useRef(
        Math.max(0, filteredOptions.indexOf(current ?? ""))
    )

    const handleHover = (value: string, hovered: boolean) => {
        if (!hovered) {
            setHoveredValue(null)
            return
        }

        const nextIndex = filteredOptions.indexOf(value)
        setDirection(nextIndex >= lastHoveredIndex.current ? 1 : -1)
        lastHoveredIndex.current = nextIndex
        setHoveredValue(value)
    }

    return (
        <div className={styles.Select} onMouseLeave={() => setHoveredValue(null)}>
            {filteredOptions.map((value) => {
                return (
                   <OptionButton
                        key={value}
                        text={value}
                        isActive={current === value}
                        onClick={() => updateOption(option.id, value)}
                        disabled={disabled}
                        data-testid={dataTestId}
                        variant="color"
                        isHighlighted={(hoveredValue ?? current) === value}
                        onHoverChange={(hovered) => handleHover(value, hovered)}
                        direction={direction}
                    />  
                )
            })}
        </div>
    )
}

export default OptionsSelect
