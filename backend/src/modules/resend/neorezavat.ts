import { randomBytes } from "crypto"
import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * E-mail vždy celý — bez Gmailího „•••" (19. 11. 2026, Matěj).
 *
 * Gmail schovává do „•••" všechno, co v e-mailu VYPADÁ jako už viděné:
 * oslovení, úvodní odstavec, patičku — když přišla podobná zpráva dřív (nebo
 * je ve stejném vlákně). Starší zákazníci tři tečky nepoznají a obsah pro ně
 * neexistuje. Totéž dělají i jiné klienty se „skrytou citací".
 *
 * Dvě pojistky:
 * 1. Do KAŽDÉHO odstavce, nadpisu a textové buňky skrytá značka jedinečná
 *    pro tuhle zprávu — žádný blok tak není shodný s žádným dřívějším.
 *    Skrytá třemi způsoby zároveň (display:none pro Gmail/Apple/Seznam,
 *    mso-hide:all pro Outlook, nulové písmo a průhlednost pro zbytek).
 * 2. Hlavička `X-Entity-Ref-ID` s jedinečnou hodnotou — Gmail pak zprávy
 *    se stejným předmětem neskládá do jednoho vlákna, kde se ořezává nejvíc.
 *
 * Gmail ořezává i zprávy nad ~102 kB („Zpráva byla zkrácena"), proto je
 * značka krátká a jen v blocích s textem.
 */
export const ZNACKA_STYL =
  "display:none!important;mso-hide:all;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;color:transparent"

export const novyToken = (): string => randomBytes(5).toString("hex")

/** Zavírací značky, před které se vloží skrytý kousek textu. */
const BLOKY = /<\/(p|h[1-6]|li|td)>/gi

export function neorezavatHtml(html: string, token: string = novyToken()): string {
  let n = 0
  return html.replace(BLOKY, (konec, _tag, offset: number) => {
    // Jen tam, kde blok nese text — prázdné rozpěrky a buňky s obrázkem nechat.
    const zacatek = html.lastIndexOf("<", offset - 1)
    const predchozi = html.slice(Math.max(0, zacatek - 400), offset)
    const textBloku = predchozi.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "")
    if (!textBloku) return konec
    n += 1
    return `<span style="${ZNACKA_STYL}">${token}${n}</span>${konec}`
  })
}

export const hlavickyNeorezavat = (token: string = novyToken()) => ({
  "X-Entity-Ref-ID": `${Date.now().toString(36)}-${token}`,
})

const DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'

/** Šablona → HTML, stejně jako to dělá @react-email/render (doctype + statický markup). */
export const vykresliEmail = (element: ReactElement): string => DOCTYPE + renderToStaticMarkup(element)
