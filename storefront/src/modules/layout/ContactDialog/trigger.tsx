"use client"

import Button from "@modules/common/components/Buttons/button"
import WebButton from "@modules/common/components/Buttons/webButton"

import { useContactDialog } from "."
import type { Inquiry } from "./panel"
import styles from "./style.module.scss"

type ContactTriggerProps = {
  text: string
  img?: string
  alt?: string
  className?: string
  /** Pre-selects the topic, so a CTA beside the courses copy opens on "Kurzy". */
  topic?: Inquiry
}

/** The button that opens the site-wide contact dialog. Visuals unchanged from the old CTA. */
export default function ContactTrigger({
  text,
  img,
  alt = "Dekorativní pozadí tlačítka",
  className,
  topic,
}: ContactTriggerProps) {
  const { open, isOpen } = useContactDialog()
  const resolvedTopic =
    topic ?? (text.toLocaleLowerCase("cs").includes("kurz") ? "Kurzy" : "Obecný dotaz")

  return (
    <div className={styles.trigger}>
      {img ? (
        <Button
          img={img}
          alt={alt}
          Kind="Button"
          title={text}
          className={className}
          /* An open dialog is „being on Kontakt" — the button holds the same
             active look the nav links get on their own routes. */
          isActive={isOpen}
          onClickAction={() => open(resolvedTopic)}
        />
      ) : (
        <WebButton
          Kind="Button"
          title={text}
          className={className}
          onClickAction={() => open(resolvedTopic)}
        />
      )}
    </div>
  )
}
