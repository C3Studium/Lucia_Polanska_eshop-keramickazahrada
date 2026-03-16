import { StoreProduct } from "@medusajs/types";
import Product from "./product";
import SoldProducts from "./Sold";

export default function ProductPage({ product }: { product: StoreProduct}) {
    return (
        <section>
            <Product product={product}/>
            <SoldProducts />
        </section>
    )
}