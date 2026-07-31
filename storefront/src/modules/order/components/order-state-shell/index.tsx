import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { ReactNode } from "react"
import s from "./style.module.scss"

type OrderStateShellProps = {
  eyebrow: string
  title: string
  accent?: string
  description: string
  status?: "pending" | "success" | "canceled"
  primary?: {
    href: string
    label: string
  }
  secondary?: {
    href: string
    label: string
  }
  children?: ReactNode
}

export default function OrderStateShell({
  eyebrow,
  title,
  accent,
  description,
  status = "success",
  primary,
  secondary,
  children,
}: OrderStateShellProps) {
  return (
    <main className={s.root} data-status={status}>
      <div className={s.header}>
        <span>{eyebrow}</span>
        <span>Keramická zahrada</span>
      </div>

      <section className={s.content}>
        <div className={s.mark} aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>{status === "pending" ? "…" : status === "success" ? "✓" : "×"}</strong>
        </div>

        <div className={s.copy}>
          <p className={s.kicker}>
            {status === "pending"
              ? "Objednávku právě dokončujeme"
              : status === "success"
                ? "Objednávka je v bezpečí"
                : "Objednávka nebyla dokončena"}
          </p>
          <h1>
            {title}
            {accent && <em>{accent}</em>}
          </h1>
          <p className={s.description}>{description}</p>

          {children}

          {(primary || secondary) && (
            <div className={s.actions}>
              {primary && (
                <LocalizedClientLink className={s.primary} href={primary.href}>
                  <span>{primary.label}</span>
                  <i aria-hidden="true">↗</i>
                </LocalizedClientLink>
              )}
              {secondary && (
                <LocalizedClientLink className={s.secondary} href={secondary.href}>
                  {secondary.label}
                </LocalizedClientLink>
              )}
            </div>
          )}
        </div>
      </section>

      <div className={s.footer}>
        <span>Bezpečná platba</span>
        <span>Osobní péče</span>
        <span>Ateliér · Písek</span>
      </div>
    </main>
  )
}
