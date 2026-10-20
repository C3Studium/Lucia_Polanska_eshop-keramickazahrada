import type { Metadata } from "next"

import { getLegalFacts } from "@lib/data/legal-facts"
import { fact } from "@lib/legal/facts"
import Certifikaty from "@modules/certifikaty"

/*
 * /certifikaty — protokoly o nezávadnosti glazur (LEGAL_AUDIT.md § 0b, N1).
 * Seznam je v `lib/certificates.ts`; stránka jen vypisuje. Kontaktní e-mail
 * z právních údajů, ať je jeden zdroj.
 */
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Certifikáty a protokoly o nezávadnosti glazur",
  description:
    "Protokoly ze zkoušek uvolňování olova a kadmia u glazur, které používáme na keramiku určenou pro jídlo a pití.",
}

export default async function Page() {
  const facts = await getLegalFacts()
  const email = fact("seller.email", facts) ?? "info@keramickazahrada.cz"
  return <Certifikaty email={email} />
}
