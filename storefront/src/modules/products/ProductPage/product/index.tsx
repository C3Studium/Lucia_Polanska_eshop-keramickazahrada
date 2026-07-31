
import { HttpTypes } from "@medusajs/types";
import { BundleProduct } from "@lib/data/products";
import { notFound } from "next/navigation";
import ProductDetails from "./details/details";


type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  categories?: HttpTypes.StoreProductCategory[]
  wishlistItems?: any[]
  isAuthenticated?: boolean
  initialRating?: number
  initialCount?: number
  bundle?: BundleProduct
  isBundlePreview?: boolean
}

const Product: React.FC<ProductTemplateProps> = ({ product, region, countryCode, categories, wishlistItems, isAuthenticated, initialRating, initialCount, bundle, isBundlePreview }) => {

    // If the product is not found return not found page
    if (!product || !product.id) {
        return notFound()
    }


    return(
        <section
            className="product"
            id="product-overview"
            data-scroll-section
            data-scroll-label="Objekt"
        >
            <ProductDetails product={product} categories={categories} region={region} countryCode={countryCode} wishlistItems={wishlistItems} isAuthenticated={isAuthenticated} initialRating={initialRating} initialCount={initialCount} bundle={bundle} isBundlePreview={isBundlePreview} />
        </section>
    )
}

export default Product;
