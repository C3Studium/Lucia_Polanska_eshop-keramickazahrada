import "server-only"

import { getPublishedLegalRegistry } from "@lib/data/legal-registry"

import { orderTermsRefFrom, type OrderLike, type OrderTermsRef } from "./order-terms-ref"

export { orderTermsRefFrom, type OrderTermsRef } from "./order-terms-ref"

/*
 * Čistá půlka (`orderTermsRefFrom`, typ) je v `./order-terms-ref.ts` — testuje
 * se bez Nextu (`scripts/legal-cms-roundtrip.test.mjs`).
 */

/**
 * `orderTermsRefFrom` nad publikovaným registrem (bez konceptů ze Studia —
 * k objednávce se váže jen znění, které opravdu vyšlo).
 */
export const orderTermsRef = async (order: OrderLike): Promise<OrderTermsRef | null> =>
  orderTermsRefFrom(await getPublishedLegalRegistry(), order)
