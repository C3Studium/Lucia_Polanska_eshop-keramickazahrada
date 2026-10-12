import { createHash } from "crypto"

/**
 * „Potřebuji změnit objednávku" — žádost zákazníka o změnu objednávky ze
 * stránky úpravy (12. 10. 2026, Matěj).
 *
 * ## Proč to není mini obchod
 *
 * Zákazník si dřív na stránce úpravy sám přidával, odebíral a vyměňoval kusy
 * (`lib/order-edit`). Nově se změny zboží domlouvají osobně: zákazník napíše,
 * co potřebuje, a Lucie mu zavolá nebo odepíše. Samoobsluha zůstala jen pro
 * doručovací adresu / výdejnu (`store/orders/:id/delivery`).
 *
 * ## Proč přes kontaktní formulář
 *
 * Kanál je stejný jako u kontaktního formuláře (`store/contact`): zvonek +
 * e-mail majitelce s Reply-To na zákazníka — odpovídá ze schránky. Jen se
 * jméno, e-mail a číslo objednávky neberou z formuláře, ale z objednávky
 * ověřené podepsaným tokenem (stejný token jako stránka úpravy), takže si
 * nikdo nemůže „objednat změnu" cizí objednávky ani podstrčit cizí e-mail.
 * Telefon je povinný — Lucie chce mít možnost zavolat.
 *
 * Čistá funkce (bez kontejneru), ať jde text e-mailu ověřit testem.
 */

export type OrderChangeOrder = {
  id: string
  display_id?: number | string | null
  email?: string | null
  customer_name?: string | null
}

export type OrderChangeInput = {
  phone: string
  message: string
}

/** Kolik číslic musí telefon mít, aby šel vytočit (bez předvolby min. 9 u CZ/SK; 6 = rozumné minimum pro zahraniční). */
export const MIN_PHONE_DIGITS = 6

export const isDialablePhone = (value: string): boolean =>
  value.replace(/\D/g, "").length >= MIN_PHONE_DIGITS

/**
 * Odkaz na objednávku v administraci (`/app/orders/:id`) — stejný základ
 * adresy jako tlačítko v šabloně `merchant-notification`. Prázdný, když
 * adresa backendu není nastavená (pak se řádek v e-mailu vynechá).
 */
export const adminOrderUrl = (
  orderId: string,
  base: string | null | undefined = process.env.BACKEND_PUBLIC_URL ||
    process.env.MEDUSA_BACKEND_URL
): string => {
  const root = (base ?? "").trim().replace(/\/+$/, "")
  return root && orderId ? `${root}/app/orders/${orderId}` : ""
}

export type OrderChangeNotification = {
  key: string
  title: string
  description: string
  replyTo?: string
}

/**
 * Upozornění majitelce: z předmětu musí být hned jasné, že jde o ŽÁDOST
 * O ZMĚNU objednávky #N (ne obecný dotaz), v těle kontakt (e-mail, telefon),
 * odkaz do administrace a zpráva zákazníka. Klíč = objednávka + otisk zprávy,
 * takže netrpělivý dvojklik pošle jednu zprávu, ne dvě.
 */
export const buildOrderChangeNotification = (
  order: OrderChangeOrder,
  input: OrderChangeInput,
  adminUrl: string = adminOrderUrl(order.id)
): OrderChangeNotification => {
  const number = `#${order.display_id ?? ""}`.trim()
  const name = (order.customer_name ?? "").trim()
  const email = (order.email ?? "").trim()
  const phone = input.phone.trim()
  const message = input.message.trim()

  const digest = createHash("sha1")
    .update(`${order.id}|${phone}|${message}`)
    .digest("hex")

  return {
    key: `mn:order-change:${order.id}:${digest}`,
    title: `Žádost o změnu objednávky ${number}`,
    description: [
      `Zákazník žádá o změnu objednávky ${number} — ozvěte se mu prosím telefonem nebo e-mailem (odpověď na tento e-mail půjde rovnou jemu).`,
      "",
      `Od: ${name || "zákazník"}${email ? ` <${email}>` : ""}`,
      `Telefon: ${phone}`,
      adminUrl ? `Objednávka v administraci: ${adminUrl}` : null,
      "",
      "Zpráva:",
      message,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
    ...(email ? { replyTo: email } : {}),
  }
}
