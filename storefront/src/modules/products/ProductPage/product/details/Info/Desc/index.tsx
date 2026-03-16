import { HttpTypes } from "@medusajs/types";

import styles from "./style.module.scss";

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const Desc = ({ product }: ProductInfoProps) => {
    const description = (product.description || "").trim();
    const words = description.split(/\s+/).filter(Boolean);
    const isLongDescription = words.length > 40;
    const previewText = isLongDescription
        ? `${words.slice(0, 40).join(" ")}...`
        : (description || "N/A");

    const handleOpenFullDescription = () => {
        if (typeof window === "undefined") return;

        window.dispatchEvent(new CustomEvent("open-product-details-desc"));
        document.getElementById("product-details")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    return (
        <div className={styles.desc__Container}>
            <p>{previewText}</p>
            {isLongDescription && (
                <button
                    type="button"
                    className={styles.desc__Link}
                    onClick={handleOpenFullDescription}
                >
                    Zobrazit celý popis
                </button>
            )}
        </div>
    )
}

export default Desc;
