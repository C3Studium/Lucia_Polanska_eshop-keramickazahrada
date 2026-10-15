"use client"

import { useStudioSurface } from "@c3studium/valecms/edit"
import { useCallback, useRef, useState } from "react"

import type { CourseTerm } from "@lib/data/courses"
import type { LegalFacts } from "@lib/legal/facts"
import Rezervace from "@modules/kurzy/Rezervace"
import RezervaceModal from "@modules/kurzy/RezervaceModal"

import Intro from "./Intro"
import type { CopyBlocks } from "@lib/util/site-copy"

/**
 * The kurzy page: the pinned timeline, the reservation teaser, and — over
 * both — the reservation modal. „Vybrat termín" (in the timeline's third
 * audience block and in the teaser) opens it; whoever opened it gets their
 * focus back when it closes, the ContactDialog contract.
 */
export default function Kurzy({
  copy,
  terms,
  legalFacts,
}: {
  /** Bloky stránky `kurzy` z CMS; termíny níž jsou z Medusy. */
  copy: CopyBlocks
  terms: CourseTerm[]
  /** Právní údaje (storno podmínky, e-mail) pro rezervaci — `getLegalFacts()` na serveru. */
  legalFacts?: LegalFacts
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  const openModal = useCallback(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    triggerRef.current?.focus()
  }, [])

  /*
   * Povrch „Rezervace kurzu — okno" ve Studiu (`valecms.config.ts`,
   * `surfaces`): okno se v rámu otevře samo, texty v něm jdou upravit
   * klikáním. Mimo rám Studia vždycky `false`.
   */
  const studioOpen = useStudioSurface("rezervace-okno")

  return (
    <main className="kurzy">
      <Intro
        block={copy["kurzy.intro"]}
        gallery={copy["kurzy.galerie"]}
        about={copy["kurzy.about"]}
        onReserveAction={openModal}
      />
      <Rezervace
        terms={terms}
        onReserveAction={openModal}
        block={copy["kurzy.rezervace"]}
        okno={copy["kurzy.rezervace-okno"]}
      />
      {/* Nadpis okna je týž blok jako nadpis sekce s termíny; ostatní texty
          okna mají vlastní blok `kurzy.rezervace-okno`. */}
      <RezervaceModal
        open={modalOpen || studioOpen}
        onCloseAction={closeModal}
        initialTerms={terms}
        legalFacts={legalFacts}
        heading={copy["kurzy.rezervace"]}
        block={copy["kurzy.rezervace-okno"]}
      />
    </main>
  )
}
