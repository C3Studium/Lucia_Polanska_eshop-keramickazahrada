
import { HttpTypes } from "@medusajs/types";
import { BundleProduct } from "@lib/data/products";
import { notFound } from "next/navigation";
import ProductDetails, { type ProductPickMode } from "./details/details";
import type { ProductionProfile } from "@lib/util/made-to-order";


type ProductTemplateProps = {
    productionProfile?: ProductionProfile | null;
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  categories?: HttpTypes.StoreProductCategory[]
  wishlistItems?: any[]
  isAuthenticated?: boolean
  hasSavedAddress?: boolean
  initialRating?: number
  initialCount?: number
  bundle?: BundleProduct
  isBundlePreview?: boolean
  /** Režim výběru do úpravy objednávky — místo košíku „Přidat k objednávce #N". */
  pick?: ProductPickMode
}

const Product: React.FC<ProductTemplateProps> = ({ product, region, countryCode, categories, wishlistItems, isAuthenticated, hasSavedAddress, initialRating, initialCount, bundle, isBundlePreview, productionProfile, pick }) => {

    // If the product is not found return not found page
    if (!product || !product.id) {
        return notFound()
    }


    return(
        <section
            className="product"
            id="product-overview"
            data-scroll-section
            data-scroll-label="Výrobek"
        >
            <ProductDetails product={product} categories={categories} region={region} countryCode={countryCode} wishlistItems={wishlistItems} isAuthenticated={isAuthenticated} hasSavedAddress={hasSavedAddress} initialRating={initialRating} initialCount={initialCount} bundle={bundle} isBundlePreview={isBundlePreview} productionProfile={productionProfile} pick={pick} />
        </section>
    )
}

export default Product;
