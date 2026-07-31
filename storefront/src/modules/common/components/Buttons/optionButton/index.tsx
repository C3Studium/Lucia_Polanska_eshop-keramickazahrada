import { motion } from "framer-motion"

type HashtagButtonProps = {
    text: string;
    isActive: boolean;
    onClick: () => void
    disabled?: boolean; 
    "data-testid"?: string; // Optional prop for testing purposes
    variant?: "size" | "color"; // Optional prop for button variant
    isHighlighted?: boolean
    onHoverChange?: (hovered: boolean) => void
    direction?: 1 | -1
}

// Universal button for hashtag selection with form state management

export default function OptionButton({
    text, 
    isActive, 
    onClick,
    disabled = false,
    "data-testid": dataTestId,
    variant,
    isHighlighted = isActive,
    onHoverChange,
    direction = 1,
}: HashtagButtonProps) {
    const variantClass =
        variant === "color"
            ? "productOptionButton--color"
            : "productOptionButton--size"
    const activeClass = isActive ? " productOptionButton--active" : ""

    return (
        <button
            type="button"
            className={`productOptionButton ${variantClass}${activeClass}`}
            disabled={disabled}
            data-testid={dataTestId}
            aria-pressed={isActive}
            onClick={onClick}
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
            onFocus={() => onHoverChange?.(true)}
            onBlur={() => onHoverChange?.(false)}
        >
            <motion.span
                className="productOptionButton__indicator"
                initial={false}
                animate={{ scaleX: isHighlighted ? 1 : 0 }}
                style={{ originX: direction === 1 ? 0 : 1 }}
                transition={{ duration: 0.42, ease: [0.76, 0, 0.24, 1] }}
            />
            <span className="productOptionButton__label">{text}</span>
        </button>
    )
}
