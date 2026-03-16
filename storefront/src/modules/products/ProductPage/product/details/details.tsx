'use client';

import { useEffect, useMemo, useState } from "react";
import Title from "./Info/Title";
import Desc from "./Info/Desc";
import Colors from "./Options/Colors";
import { HttpTypes } from "@medusajs/types";
import { Star, StarSolid } from "@medusajs/icons";
import Sizes from "./Options/Sizes";
import ProductPrice from "./Cta/Price";
import CTA from "./Cta/Add";
import { addToCart } from "@lib/data/cart";
import { isEqual } from "lodash";
import RestockForm from "../../restock";
import Details from "@modules/products/ProductPage/details"
import Gallery from "../Gallery/gallery";


type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  categories?: HttpTypes.StoreProductCategory[]
  wishlistItems?: any[]
  onWishlistUpdateAction?: () => Promise<void>
  isAuthenticated?: boolean
  initialRating?: number
  initialCount?: number
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}


const ProductDetails: React.FC<ProductTemplateProps> = ({ product, region, countryCode, categories, wishlistItems, onWishlistUpdateAction, isAuthenticated, initialRating, initialCount }) => {
    const [options, setOptions] = useState<Record<string, string | undefined>>({})
    const [isAdding, setIsAdding] = useState(false)
  

    console.log("Product: ", product);
    // If there is only 1 variant, preselect the options
    useEffect(() => {
      if (product.variants?.length === 1) {
        const variantOptions = optionsAsKeymap(product.variants[0].options)
        setOptions(variantOptions ?? {})
      }
    }, [product.variants])
    useEffect(() => {
        if (product.variants && product.variants.length > 0) {
            const variantOptions = optionsAsKeymap(product.variants[0].options)
            setOptions(variantOptions ?? {})
        }
    }, [product.variants])
  
    const selectedVariant = useMemo(() => {
      if (!product.variants || product.variants.length === 0) {
        return
      }
  
      return product.variants.find((v) => {
        const variantOptions = optionsAsKeymap(v.options)
        return isEqual(variantOptions, options)
      })
    }, [product.variants, options])
  
    // update the options when a variant is selected
    const setOptionValue = (optionId: string, value: string) => {
      setOptions((prev) => ({
        ...prev,
        [optionId]: value,
      }))
    }
  
    //check if the selected options produce a valid variant
    const isValidVariant = useMemo(() => {
      return product.variants?.some((v) => {
        const variantOptions = optionsAsKeymap(v.options)
        return isEqual(variantOptions, options)
      })
    }, [product.variants, options])
  
    // check if the selected variant is in stock
    const inStock = useMemo(() => {
      // If we don't manage inventory, we can always add to cart
      if (selectedVariant && !selectedVariant.manage_inventory) {
        return true
      }

      console.log("Product in stock: ", selectedVariant?.inventory_quantity);
  
      // If we allow back orders on the variant, we can add to cart
      if (selectedVariant?.allow_backorder) {
        return true
      }
  
      // If there is inventory available, we can add to cart
      if (
        selectedVariant?.manage_inventory &&
        (selectedVariant?.inventory_quantity || 0) > 0
      ) {
        return true
      }
  
      // Otherwise, we can't add to cart
      return false
    }, [selectedVariant])  
  
    // add the selected variant to the cart
    const handleAddToCart = async () => {
      if (!selectedVariant?.id) return null

      setIsAdding(true)
      try {
        const res = await addToCart({
          variantId: selectedVariant.id,
          quantity: 1,
          countryCode,
        })
        if (!res?.success) {
          console.error("Failed to add to cart:", res?.message)
        }
      } catch (e: any) {
        console.error("Failed to add to cart:", e?.message || e)
      } finally {
        setIsAdding(false)
      }
    }

    // WIP finish here the styling and scss
    return (
        <div className="product__details">
          <div className="info__container">
            <div className="product__details__mainDetails">
              <Title product={product} categories={categories} />
              <Desc product={product} />
            </div>

            <div className="product__details__cta">
              <ProductPrice product={product} variant={selectedVariant} countryCode={countryCode} />
              <CTA
                inStock={inStock}
                selectedVariant={selectedVariant}
                isAdding={isAdding}
                isValidVariant={!!isValidVariant}
                handleAddToCart={handleAddToCart}
                options={options}
                product={product}
                wishlistItems={wishlistItems}
                onWishlistUpdateAction={onWishlistUpdateAction}
                isAuthenticated={isAuthenticated}
              />
              <div className="divider"/>
            </div>
            {/* <div className="product__reviews">
              {initialRating !== undefined && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span key={index}>
                          {index >= Math.round(initialRating || 0) ? (
                              <Star/>
                          ) : (
                              <StarSolid className="text-ui-tag-orange-icon" />
                          )}
                        </span>
                      ))}
                    </div>
                    <span>
                      {initialCount} {initialCount === 1  ? "recenze" : "recenzí"}
                    </span>
                </div>
              )}
            </div>             */}

            <Details
              product={product} 
            />
          </div>
          <div className="images_container">
              <Gallery product={product} region={region} countryCode={countryCode}/>
          </div>
          <div className="choice__container">
            <div className="product__details__subDetails">
              <Colors
                product={product}
                region={region}
                isAdding={isAdding}
                options={options}
                setOptionValue={setOptionValue}
              />
              <Sizes
                product={product}
                region={region}
                isAdding={isAdding}
                options={options}
                setOptionValue={setOptionValue}
              />
            </div>
            {selectedVariant && !inStock && (
              <RestockForm variant={selectedVariant} product={product} />
            )}
            <div className="next__prev__products"
              //TODO
            >

            </div>
          </div>
            
        </div>
    )
}

export default ProductDetails;