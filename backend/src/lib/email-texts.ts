import * as React from "react"
import { render } from "@react-email/components"
import { EMAIL_COPY } from "../modules/resend/email-copy"
import ResendNotificationProviderService, { EmailTemplates } from "../modules/resend/service"
import { withEmailTextOverrides } from "../modules/resend/components/email-i18n"
import { withEmailLegalFacts } from "../modules/resend/components/email-ui"
import { merchantNotificationEmail } from "../modules/resend/emails/merchant-notification"
import type { LiveLegalFacts } from "./legal"
import type { MerchantOrderSummary } from "./merchant-order-summary"

/**
 * Administrace → Emaily (15. 11. 2026, přání klientky): vybrat e-mail,
 * přepsat jeho texty a hned vidět náhled.
 *
 * Co jde upravit: předmět u každého e-mailu a textová pole šablon, které mají
 * texty pohromadě v \`COPY\` (\`modules/resend/email-copy.ts\`). Jen česky —
 * zákazníci z ciziny dostávají dál překlad z kódu. Uložené znění leží
 * v nastavení obchodu (\`email_texts\`) a Resend provider ho použije při
 * každém odeslání (i při opakování z Přehled → Odeslané e-maily).
 */

/** Šablony, které chodí majitelce, ne zákazníkovi — záložka Admin. */
const PRO_MAJITELKU = new Set([
  "merchant-notification",
  "merchant-daily-summary",
  "merchant-weekly-summary",
  "user-invited",
])

/**
 * Předmět těchhle šablon skládá odesílatel (`data.subject` — číslo objednávky,
 * datum souhrnu), takže přepsaný předmět by se nikdy nepoužil. V administraci
 * se proto jen ukazuje.
 */
const PREDMET_Z_KODU = new Set([
  "merchant-notification",
  "merchant-daily-summary",
  "merchant-weekly-summary",
])

export type EmailAudience = "customer" | "owner"

/**
 * Skupiny podle toho, k čemu se e-mail váže (21. 11. 2026, Matěj) — filtr
 * v administraci → Emaily. Pořadí = pořadí v seznamu.
 */
export const EMAIL_CATEGORIES: Array<{ key: string; label: string; audience: EmailAudience }> = [
  { key: "objednavka", label: "Objednávka", audience: "customer" },
  { key: "doprava", label: "Doprava a vyzvednutí", audience: "customer" },
  { key: "platby", label: "Platby", audience: "customer" },
  { key: "vraceni", label: "Vrácení a reklamace", audience: "customer" },
  { key: "zakazky", label: "Zakázky", audience: "customer" },
  { key: "kurzy", label: "Kurzy", audience: "customer" },
  { key: "poukazy", label: "Poukazy a slevy", audience: "customer" },
  { key: "ucet", label: "Účet a kontakt", audience: "customer" },
  { key: "novinky", label: "Novinky a nabídky", audience: "customer" },
  { key: "ostatni", label: "Ostatní", audience: "customer" },
  { key: "admin-objednavky", label: "Nové objednávky", audience: "owner" },
  { key: "admin-zakazky", label: "Zakázky", audience: "owner" },
  { key: "admin-souhrny", label: "Souhrny", audience: "owner" },
  { key: "admin-ostatni", label: "Ostatní", audience: "owner" },
]

const KATEGORIE: Record<string, string> = {
  "order-placed": "objednavka",
  "order-edited": "objednavka",
  "order-preparing": "objednavka",
  "order-ready": "objednavka",
  "order-delayed": "objednavka",
  "order-cancelled": "objednavka",
  "order-review": "objednavka",
  "invoice-issued": "objednavka",
  "contract-resent": "objednavka",
  "abandoned-cart": "objednavka",
  "order-shipment": "doprava",
  "order-ready-pickup": "doprava",
  "order-delivered": "doprava",
  "payment-received": "platby",
  "payment-failed": "platby",
  "payment-pending": "platby",
  "payment-refunded": "vraceni",
  "order-refunded": "vraceni",
  "refund-request": "vraceni",
  "return-approved": "vraceni",
  "return-rejected": "vraceni",
  "return-received": "vraceni",
  "return-resolved": "vraceni",
  "commission-inquiry-received": "zakazky",
  "commission-confirmed": "zakazky",
  "commission-price-agreed": "zakazky",
  "order-processing": "zakazky",
  "production-started": "zakazky",
  "commission-message": "zakazky",
  "commission-completed": "zakazky",
  "commission-cancelled": "zakazky",
  "surcharge-notice": "zakazky",
  "surcharge-confirmed": "zakazky",
  "gift-voucher": "poukazy",
  "gift-voucher-payment": "poukazy",
  "loyalty-code": "poukazy",
  welcome: "ucet",
  "email-verification": "ucet",
  "password-reset": "ucet",
  "account-deleted": "ucet",
  "contact-received": "ucet",
  "newsletter-signup": "novinky",
  "newsletter-unsubscribe": "novinky",
  "newsletter-welcome": "novinky",
  promotional: "novinky",
  "bundle-published": "novinky",
  "price-drop": "novinky",
  "variant-restock": "novinky",
  "merchant-daily-summary": "admin-souhrny",
  "merchant-weekly-summary": "admin-souhrny",
  "merchant-notification": "admin-ostatni",
  "user-invited": "admin-ostatni",
}

export const categoryOf = (template: string): string =>
  KATEGORIE[template] ??
  (template.startsWith("course-") ? "kurzy" : PRO_MAJITELKU.has(template) ? "admin-ostatni" : "ostatni")

/** Kdy e-mail chodí — u e-mailů pro majitelku, ať ví, co znamená. */
const KDY: Record<string, string> = {
  "merchant-daily-summary":
    "Každé ráno v 7:05 — včerejší tržby, počet zaplacených objednávek a nedokončené nákupy.",
  "merchant-weekly-summary":
    "Každé pondělí ráno — uplynulý týden v číslech a srovnání s týdnem předtím.",
  "merchant-notification":
    "Všechna ostatní upozornění — doplatek přijat, štítek připravený, nová žádost o reklamaci, rezervace kurzu, zpráva z kontaktního formuláře a další. Vzhled je stejný, mění se nadpis a text.",
  "user-invited":
    "Když někoho pozvete do administrace. Chodí pozvanému, ne vám.",
}

/* ------------------------------------------------------------------ varianty */

const vzorovaObjednavka = (patch: Partial<MerchantOrderSummary>): MerchantOrderSummary => ({
  number: "#1042",
  created: "21. 11. 2026 9:14",
  customer: "Jana Nováková",
  contact: "jana.novakova@example.cz\n+420 777 123 456",
  shipping_method: "Česká pošta — balík na adresu",
  shipping_price: "140 Kč",
  shipping_address: "Jana Nováková\nLipová 12\n397 01 Písek\nCZ",
  billing_address: null,
  payment: "Online platba (ComGate) — zaplaceno",
  items: [
    { label: "3× Pomněnka - různé barvy", total: "120 Kč" },
    { label: "1× Květináč Zahrada · velký", total: "1 450 Kč" },
  ],
  subtotal: "1 570 Kč",
  packaging: "60 Kč",
  service: null,
  discount: null,
  shipping: "140 Kč",
  total: "1 770 Kč",
  customer_note: null,
  admin_url: null,
  ...patch,
})

const zakazkovaObjednavka = (patch: Partial<MerchantOrderSummary>): MerchantOrderSummary =>
  vzorovaObjednavka({
    shipping_method: "Osobní odběr",
    shipping_price: "0 Kč",
    shipping_address: "",
    items: [{ label: "1× Domovní znamení na zakázku", total: "4 500 Kč" }],
    subtotal: "4 500 Kč",
    packaging: null,
    shipping: "0 Kč",
    total: "4 500 Kč",
    ...patch,
  })

type AdminVariant = {
  id: string
  title: string
  category: string
  when: string
  props: Parameters<typeof merchantNotificationEmail>[0]
}

/**
 * E-mail „Nová objednávka" pro majitelku v jednotlivých podobách — jedna
 * šablona (`merchant-notification`), nadpis a text skládá
 * `subscribers/merchant-notifications.ts` podle platby a druhu objednávky.
 * Tady jen jako náhled se vzorovými daty, aby majitelka věděla, co který
 * předmět znamená (21. 11. 2026).
 */
const ADMIN_VARIANTS: AdminVariant[] = [
  {
    id: "merchant-notification#zaplacena",
    title: "Nová zaplacená objednávka",
    category: "admin-objednavky",
    when:
      "Online platba přes ComGate (karta, Apple Pay, Google Pay, bankovní tlačítko). Objednávka vznikne až ve chvíli, kdy ComGate sám potvrdí, že je zaplaceno — peníze tedy dorazily. Stejně přijde i objednávka za 0 Kč (celá zaplacená poukazem).",
    props: {
      title: "Nová zaplacená objednávka #1042",
      description: "Jana Nováková · 1 770 Kč · 2 položky",
      order: vzorovaObjednavka({}),
    },
  },
  {
    id: "merchant-notification#dobirka",
    title: "Nová objednávka — platba při převzetí (dobírka)",
    category: "admin-objednavky",
    when:
      "Zákazník platí dobírkou. Zatím nic nezaplatil — peníze vybere Česká pošta při doručení a pošle je dál.",
    props: {
      title: "Nová objednávka #1043 — platba při převzetí",
      description: "Jana Nováková · 1 829 Kč · 2 položky",
      order: vzorovaObjednavka({
        number: "#1043",
        payment: "Dobírka — zaplatí při převzetí",
        service: "59 Kč",
        total: "1 829 Kč",
      }),
    },
  },
  {
    id: "merchant-notification#odber",
    title: "Nová objednávka — platba při převzetí (osobní odběr)",
    category: "admin-objednavky",
    when:
      "Zákazník si objednávku vyzvedne v ateliéru a zaplatí na místě. Zatím nic nezaplatil — po zaplacení klikněte u objednávky na „Objednávka zaplacena“, tím se vystaví faktura.",
    props: {
      title: "Nová objednávka #1044 — platba při převzetí",
      description: "Jana Nováková · 1 630 Kč · 2 položky",
      order: vzorovaObjednavka({
        number: "#1044",
        shipping_method: "Osobní odběr",
        shipping_price: "0 Kč",
        shipping_address: "",
        payment: "Platba při vyzvednutí v ateliéru",
        shipping: "0 Kč",
        total: "1 630 Kč",
      }),
    },
  },
  {
    id: "merchant-notification#z-poptavky",
    title: "Objednávka z poptávky — založená",
    category: "admin-objednavky",
    when: "Objednávku jste sama založila z poptávky zakázky. Zadání znáte, proto jen tenhle jeden e-mail.",
    props: {
      title: "Objednávka #1048 z poptávky — založená",
      description: "Jana Nováková · 4 500 Kč · 1 položka",
      order: zakazkovaObjednavka({ number: "#1048" }),
    },
  },
  {
    id: "merchant-notification#zakazka-cela",
    title: "Nová zakázka — zaplacená celá",
    category: "admin-zakazky",
    when: "Zakázka je zaplacená celá přes ComGate. Spolu s ní přijde i „přečtěte si zadání“.",
    props: {
      title: "Nová zakázka #1045 — zaplacená celá",
      description:
        "Jana Nováková · zakázka · celkem 4 500 Kč · zaplaceno 4 500 Kč · 1 položka",
      order: zakazkovaObjednavka({ number: "#1045" }),
    },
  },
  {
    id: "merchant-notification#zakazka-zaloha",
    title: "Nová zakázka — zaplacená záloha",
    category: "admin-zakazky",
    when:
      "Zákazník zaplatil přes ComGate zálohu, zbytek doplatí později (výzvu k doplacení pošlete z objednávky). Spolu s ní přijde i „přečtěte si zadání“.",
    props: {
      title: "Nová zakázka #1046 — zaplacená záloha 1 125 Kč",
      description:
        "Jana Nováková · zakázka · celkem 4 500 Kč · zaplacená záloha 1 125 Kč · zbývá doplatit 3 375 Kč · 1 položka",
      order: zakazkovaObjednavka({ number: "#1046" }),
    },
  },
  {
    id: "merchant-notification#zakazka-cena-po-domluve",
    title: "Nová zakázka — cena po domluvě",
    category: "admin-zakazky",
    when:
      "Zakázka s cenou po domluvě — nic se zatím neplatilo. Cenu nastavíte u objednávky a zákazníkovi pošlete e-mail k zaplacení.",
    props: {
      title: "Nová zakázka #1047 — cena po domluvě",
      description: "Jana Nováková · zakázka · celkem 0 Kč · zaplaceno 0 Kč · 1 položka",
      order: zakazkovaObjednavka({
        number: "#1047",
        payment: "Bez platby při objednání",
        items: [{ label: "1× Domovní znamení na zakázku", total: "0 Kč" }],
        subtotal: "0 Kč",
        total: "0 Kč",
      }),
    },
  },
  {
    id: "merchant-notification#zakazka-zadani",
    title: "Nová zakázka — přečtěte si zadání",
    category: "admin-zakazky",
    when:
      "Ke každé nové zakázce (vedle e-mailu o platbě) — zadání a fotky od zákazníka najdete v Zakázkách.",
    props: {
      title: "Nová zakázka #1046 — přečtěte si zadání",
      description:
        "Jana Nováková si objednal(a) výrobu na míru. Zadání najdete v Zakázkách.",
    },
  },
]

const variantOf = (id: string) => ADMIN_VARIANTS.find((variant) => variant.id === id) ?? null

/** Jde e-mail ukázat v náhledu? Šablona i podoba „Nové objednávky". */
export const isPreviewableEmail = (id: string) => isEditableEmail(id) || Boolean(variantOf(id))

/** Lidské názvy polí — ostatní pole se ukážou pod názvem z kódu. */
const POPISKY: Record<string, string> = {
  preview: "Text v náhledu schránky (pod předmětem)",
  eyebrow: "Malý nadpis nahoře",
  title: "Nadpis",
  accent: "Nadpis — zvýrazněný konec",
  intro: "Úvodní odstavec",
  lead: "Úvodní odstavec",
  body: "Text",
  text: "Text",
  next: "Nadpis „Co bude dál“",
  more: "Doplňující věta",
  closing: "Rozloučení před podpisem",
  cta: "Text tlačítka",
  button: "Text tlačítka",
  note: "Poznámka",
  help: "Nápověda",
}

export type EmailTextField = {
  key: string
  label: string
  default: string
  value: string
}

export type EmailTextTemplate = {
  /** Klíč v seznamu — šablona, u podob „Nové objednávky" `šablona#podoba`. */
  id: string
  template: string
  title: string
  audience: EmailAudience
  forOwner: boolean
  /** Skupina podle akce (`EMAIL_CATEGORIES`). */
  category: string
  /** Kdy e-mail chodí — jen u e-mailů pro majitelku. */
  when: string | null
  /** Jen náhled: text i předmět skládá obchod z objednávky. */
  readOnly: boolean
  /** Jde přepsat předmět? (Ne tam, kde ho skládá odesílatel.) */
  editableSubject: boolean
  /** Jde upravit i text (ne jen předmět)? */
  editableBody: boolean
  subject: { default: string; value: string }
  fields: EmailTextField[]
}

const templateFile = (template: string) => (template === "variant-restock" ? "restock" : template)

/** Výchozí český předmět — tatáž logika jako při odeslání. */
export const defaultSubject = (template: string): string => {
  const subject = ResendNotificationProviderService.prototype.getTemplateSubject.call(
    { options: {} },
    template as never,
    "cs"
  )
  return typeof subject === "string" ? subject : ""
}

export const EMAIL_TEXT_TEMPLATES: string[] = (Object.values(EmailTemplates) as unknown[]).filter(
  (value): value is string => typeof value === "string"
)

export const isEditableEmail = (template: string) => EMAIL_TEXT_TEMPLATES.includes(template)

const poradiKategorie = (key: string) => {
  const index = EMAIL_CATEGORIES.findIndex((category) => category.key === key)
  return index < 0 ? EMAIL_CATEGORIES.length : index
}

/**
 * Všechny e-maily s výchozím zněním a tím, co je uložené — zákaznické podle
 * akce, pro majitelku i jednotlivé podoby „Nové objednávky" (jen náhled).
 */
export const emailTextCatalog = (
  stored: Record<string, Record<string, string>> | null | undefined
): EmailTextTemplate[] => {
  const templates: EmailTextTemplate[] = EMAIL_TEXT_TEMPLATES.map((template) => {
    const saved = stored?.[template] ?? {}
    const cs = (EMAIL_COPY[template]?.cs ?? {}) as Record<string, unknown>
    const fields = Object.entries(cs)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => ({
        key,
        label: POPISKY[key] ?? key,
        default: value as string,
        value: saved[key] ?? "",
      }))
    const subjectDefault = defaultSubject(template)
    const forOwner = PRO_MAJITELKU.has(template)
    const editableSubject = !PREDMET_Z_KODU.has(template)
    const isGeneric = template === "merchant-notification"
    return {
      id: template,
      template,
      title: isGeneric ? "Ostatní upozornění" : subjectDefault || template,
      audience: forOwner ? "owner" : "customer",
      forOwner,
      category: categoryOf(template),
      when: KDY[template] ?? null,
      readOnly: !editableSubject && fields.length === 0,
      editableSubject,
      editableBody: fields.length > 0,
      subject: { default: subjectDefault, value: saved.subject ?? "" },
      fields,
    }
  })

  const variants: EmailTextTemplate[] = ADMIN_VARIANTS.map((variant) => ({
    id: variant.id,
    template: "merchant-notification",
    title: variant.title,
    audience: "owner",
    forOwner: true,
    category: variant.category,
    when: variant.when,
    readOnly: true,
    editableSubject: false,
    editableBody: false,
    subject: { default: variant.props.title ?? variant.title, value: "" },
    fields: [],
  }))

  /* Podoby „Nové objednávky" v pořadí, jak jsou napsané; ostatní podle názvu. */
  const order = new Map(ADMIN_VARIANTS.map((variant, index) => [variant.id, index]))
  return [...templates, ...variants].sort(
    (a, b) =>
      poradiKategorie(a.category) - poradiKategorie(b.category) ||
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.title.localeCompare(b.title, "cs")
  )
}

/** Jen známá pole a neprázdné texty — co se smí uložit k jedné šabloně. */
export const cleanEmailTexts = (template: string, values: Record<string, unknown>) => {
  const cs = (EMAIL_COPY[template]?.cs ?? {}) as Record<string, unknown>
  const allowed = new Set(["subject", ...Object.keys(cs).filter((key) => typeof cs[key] === "string")])
  return Object.fromEntries(
    Object.entries(values ?? {})
      .filter(([key, value]) => allowed.has(key) && typeof value === "string")
      .map(([key, value]) => [key, String(value).slice(0, 5000)] as const)
      .filter(([, value]) => value.trim() !== "")
  ) as Record<string, string>
}

/** Přepsání textů pro jednu šablonu při vykreslení (kontext pro `useCopy`). */
export const overridesFor = (template: string, values: Record<string, string> | null | undefined) =>
  values && EMAIL_COPY[template] ? { copy: EMAIL_COPY[template], values } : null

/**
 * Náhled e-mailu se vzorovými daty šablony (výchozí export souboru) a s právě
 * psaným zněním — administrace ho ukazuje vedle formuláře.
 */
export const renderEmailPreview = async (
  template: string,
  values: Record<string, string>,
  legalFacts: LiveLegalFacts | null
): Promise<{ html: string; subject: string }> => {
  /* Podoba „Nové objednávky" — šablona majitelky se vzorovou objednávkou.
     „Ostatní upozornění" (holá šablona) ukáže jiné upozornění než novou
     objednávku, ať se s ní neplete. */
  const variant =
    template === "merchant-notification"
      ? {
          title: "Ostatní upozornění",
          props: {
            title: "Doplatek přijat",
            description:
              "3 375 Kč · zakázka #1046 · Jana Nováková\nZakázka je zaplacená a připravená k odeslání.",
          },
        }
      : variantOf(template)
  if (variant) {
    const node = withEmailLegalFacts(merchantNotificationEmail(variant.props), legalFacts)
    return {
      html: await render(node as React.ReactElement),
      subject: variant.props.title ?? variant.title,
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(`../modules/resend/emails/${templateFile(template)}`) as {
    default?: () => React.ReactElement
  }
  if (typeof mod.default !== "function") {
    return { html: "<p>Náhled pro tento e-mail není k dispozici.</p>", subject: "" }
  }
  const node = withEmailLegalFacts(
    withEmailTextOverrides(React.createElement(mod.default), overridesFor(template, values)),
    legalFacts
  )
  const html = await render(node as React.ReactElement)
  return { html, subject: values.subject?.trim() || defaultSubject(template) }
}
