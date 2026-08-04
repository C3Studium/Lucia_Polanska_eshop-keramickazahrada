"use client"

import React from "react"
import { HttpTypes } from "@medusajs/types"

type WrapperProps = {
  cart: HttpTypes.StoreCart
  children: React.ReactNode
}

/**
 * ComGate is the only payment provider (D-S4). The Stripe and PayPal wrappers this used to
 * choose between are gone, along with the module-scope `loadStripe()` that fetched Stripe's
 * remote script the moment the checkout bundle was parsed.
 */
const Wrapper: React.FC<WrapperProps> = ({ children }) => <div>{children}</div>

export default Wrapper
