/**
 * Jde pošta přes SPRÁVNÝ účet Resend? (22. 11. 2026)
 *
 * 21. 11. se obchod přepínal z Matějova testovacího účtu na účet klientky.
 * Do 16:36 posílal dál přes testovací — Railway dává běžícímu serveru
 * proměnné z chvíle spuštění, nový klíč platil až s dalším nasazením —
 * a v 16:36–16:44 přes klientčin účet, kde doména ještě nebyla ověřená
 * (Resend vracel 403). Zvenku nebylo vidět ani jedno: admin ukazoval
 * „Odesláno" a v klientčině Resendu nic.
 *
 * Resend API neukáže, čí je účet, ale každá doména má v každém účtu vlastní
 * id. Doména odesílatele (`RESEND_FROM_EMAIL`) tedy musí být v účtu za
 * klíčem (`GET /domains`), musí být ověřená a — u domén obchodu — mít
 * produkční id. Testovací účet má `keramickazahrada.cz` taky, jen s jiným id.
 *
 * Při dalším přechodu účtu: nové id do `RESEND_DOMAIN_ID` (Railway, Backend)
 * nebo do `PRODUKCNI_DOMENY_RESEND` níž.
 */

import type { NalezKontroly } from "./provozni-hlidka/typy"

/** Domény obchodu → id v produkčním (klientčině) účtu Resend. */
export const PRODUKCNI_DOMENY_RESEND: Record<string, string> = {
  "keramickazahrada.cz": "21ca95d1-3242-4f04-b1bb-dcc508188200",
}

export type DomenaResend = { id: string; name: string; status: string }

/** Doména z adresy odesílatele — i ve tvaru „Jméno <adresa@domena>". */
export const domenaOdesilatele = (from: string | null | undefined): string | null => {
  const adresa = String(from ?? "").match(/<([^>]+)>/)?.[1] ?? String(from ?? "")
  const domena = adresa.split("@")[1]?.trim().toLowerCase()
  return domena || null
}

export function posudUcetResend(vstup: {
  from: string | null | undefined
  domeny: DomenaResend[]
  /** Výjimka z prostředí (`RESEND_DOMAIN_ID`), jinak `PRODUKCNI_DOMENY_RESEND`. */
  ocekavaneId?: string | null
}): NalezKontroly {
  const domena = domenaOdesilatele(vstup.from)
  if (!domena) {
    return { stav: "nenastaveno", zprava: "není nastavený odesílatel (RESEND_FROM_EMAIL)" }
  }

  const vUctu = vstup.domeny.find((d) => d.name?.toLowerCase() === domena)
  if (!vUctu) {
    return {
      stav: "chyba",
      zprava: `klíč Resend patří účtu, kde doména ${domena} vůbec není — e-maily neodejdou (HTTP 403)`,
      detail: [
        `Domény v účtu: ${vstup.domeny.map((d) => d.name).join(", ") || "žádné"}.`,
        "Zkontrolujte RESEND_API_KEY a RESEND_FROM_EMAIL v Railway (Backend).",
      ],
    }
  }

  if (vUctu.status !== "verified") {
    return {
      stav: "chyba",
      zprava: `doména ${domena} není v účtu Resend ověřená (stav „${vUctu.status}") — e-maily neodejdou (HTTP 403)`,
      detail: ["V Resendu → Domains zkontrolujte DNS záznamy a dejte Verify."],
    }
  }

  const ocekavane = vstup.ocekavaneId?.trim() || PRODUKCNI_DOMENY_RESEND[domena]
  if (ocekavane && vUctu.id !== ocekavane) {
    return {
      stav: "chyba",
      zprava: `e-maily jdou přes JINÝ účet Resend, než je produkční (třeba testovací) — doména ${domena} tam má id ${vUctu.id.slice(0, 8)}…, produkční ${ocekavane.slice(0, 8)}…`,
      detail: [
        "V produkčním účtu je pak nevidíte a podle jeho DNS se nepodepisují.",
        "Opravte RESEND_API_KEY v Railway (Backend i Storefront) a nasaďte znovu.",
        "Když jde o zamýšlený přechod účtu, dejte nové id do RESEND_DOMAIN_ID.",
      ],
    }
  }

  return {
    stav: "ok",
    zprava: `${domena} posílá ${ocekavane ? "produkční účet" : "účet za klíčem"}, doména ověřená`,
  }
}

/** Živé ověření proti Resend API (hlídka i ruční skript). Nikdy nevyhodí. */
export async function zkontrolujUcetResend(env: NodeJS.ProcessEnv = process.env): Promise<NalezKontroly> {
  const klic = env.RESEND_API_KEY?.trim()
  const from = env.RESEND_FROM_EMAIL || env.RESEND_FROM
  if (!klic) {
    return { stav: "nenastaveno", zprava: "není nastavený klíč Resend (RESEND_API_KEY)" }
  }
  /* Sandbox posílá do vlastního zachytávače (RESEND_BASE_URL) — tam není co ověřovat. */
  if (env.RESEND_BASE_URL && !env.RESEND_BASE_URL.includes("api.resend.com")) {
    return { stav: "nenastaveno", zprava: "e-maily jdou do zachytávače (sandbox), účet se neověřuje" }
  }
  try {
    const odpoved = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${klic}` },
      signal: AbortSignal.timeout(10_000),
    })
    const telo = (await odpoved.json().catch(() => ({}))) as { data?: DomenaResend[]; message?: string }
    if (!odpoved.ok) {
      return {
        stav: "chyba",
        zprava: `Resend odmítl klíč (HTTP ${odpoved.status}: ${telo.message ?? "bez důvodu"}) — e-maily neodejdou`,
      }
    }
    return posudUcetResend({ from, domeny: telo.data ?? [], ocekavaneId: env.RESEND_DOMAIN_ID })
  } catch (chyba) {
    /* Výpadek sítě není špatný účet — o ten se postará hlídka e-mailů. */
    return { stav: "ok", zprava: `účet teď nejde ověřit (${(chyba as Error)?.message ?? chyba}), zkusí se znovu` }
  }
}
