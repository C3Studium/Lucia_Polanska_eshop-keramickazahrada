import * as React from "react"
import { render } from "@react-email/components"
import { EMAIL_COPY } from "../modules/resend/email-copy"
import ResendNotificationProviderService, { EmailTemplates } from "../modules/resend/service"
import { withEmailTextOverrides } from "../modules/resend/components/email-i18n"
import { withEmailLegalFacts } from "../modules/resend/components/email-ui"
import type { LiveLegalFacts } from "./legal"

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

/** Šablony, které chodí majitelce, ne zákazníkovi — v seznamu zvlášť. */
const PRO_MAJITELKU = new Set([
  "merchant-notification",
  "merchant-daily-summary",
  "merchant-weekly-summary",
  "user-invited",
])

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
  template: string
  title: string
  forOwner: boolean
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

/** Všechny e-maily s výchozím zněním a tím, co je uložené. */
export const emailTextCatalog = (
  stored: Record<string, Record<string, string>> | null | undefined
): EmailTextTemplate[] =>
  EMAIL_TEXT_TEMPLATES.map((template) => {
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
    return {
      template,
      title: subjectDefault || template,
      forOwner: PRO_MAJITELKU.has(template),
      editableBody: fields.length > 0,
      subject: { default: subjectDefault, value: saved.subject ?? "" },
      fields,
    }
  }).sort((a, b) => Number(a.forOwner) - Number(b.forOwner) || a.title.localeCompare(b.title, "cs"))

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
