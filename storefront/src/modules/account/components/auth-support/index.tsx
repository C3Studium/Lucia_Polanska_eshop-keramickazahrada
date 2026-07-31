"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ButtonHTMLAttributes, FormHTMLAttributes, ReactNode } from "react"

import styles from "./style.module.scss"

type SupportHeaderProps = {
  eyebrow: string
  title: ReactNode
  description: ReactNode
}

export function SupportPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>
}

export function SupportHeader({
  eyebrow,
  title,
  description,
}: SupportHeaderProps) {
  return (
    <header className={styles.header}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </header>
  )
}

export function SupportForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} className={styles.form} />
}

type SupportFieldProps = {
  label: string
  index: string
  htmlFor?: string
  children: ReactNode
}

export function SupportField({
  label,
  index,
  htmlFor,
  children,
}: SupportFieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldMeta}>
        <label htmlFor={htmlFor}>{label}</label>
        <span>{index}</span>
      </div>
      <div className={styles.inputFrame}>{children}</div>
    </div>
  )
}

type SupportButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary"
}

export function SupportButton({
  children,
  variant = "primary",
  ...props
}: SupportButtonProps) {
  return (
    <button {...props} className={`${styles.action} ${styles[variant]}`}>
      <span>{children}</span>
      <i aria-hidden="true">→</i>
    </button>
  )
}

type SupportLinkProps = {
  href: string
  label: string
  children: ReactNode
}

export function SupportLink({ href, label, children }: SupportLinkProps) {
  return (
    <LocalizedClientLink href={href} className={styles.route}>
      <span>{label}</span>
      <strong>{children}</strong>
      <i aria-hidden="true">↗</i>
    </LocalizedClientLink>
  )
}

export function SupportLinks({ children }: { children: ReactNode }) {
  return (
    <nav className={styles.routes} aria-label="Další možnosti přístupu">
      {children}
    </nav>
  )
}

type SupportNoticeProps = {
  eyebrow?: string
  tone?: "neutral" | "success" | "error"
  children: ReactNode
}

export function SupportNotice({
  eyebrow,
  tone = "neutral",
  children,
}: SupportNoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role="status">
      <span className={styles.noticeMark} aria-hidden="true" />
      <div>
        {eyebrow && <small>{eyebrow}</small>}
        <p>{children}</p>
      </div>
    </div>
  )
}

export function SupportEmail({ children }: { children: ReactNode }) {
  return (
    <div className={styles.email}>
      <span>Doručovací adresa</span>
      <strong>{children}</strong>
    </div>
  )
}

export function PasswordToggle({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} type="button" className={styles.passwordToggle}>
      {children}
    </button>
  )
}
