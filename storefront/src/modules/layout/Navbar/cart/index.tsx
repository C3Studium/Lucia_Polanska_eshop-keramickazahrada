import { StoreCart } from "@medusajs/types";
import CartDropdown from "@modules/layout/components/cart-dropdown"

export default function CartButton({cart} : { cart: StoreCart | null }) {
  
  return (
    <div>
        <CartDropdown cart={cart} />
    </div>
  )
}

