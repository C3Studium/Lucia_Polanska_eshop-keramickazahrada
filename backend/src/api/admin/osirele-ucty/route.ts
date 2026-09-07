import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "zod"

import { najdiOsireleUcty, spravUcet, type Oprava } from "../../../lib/orphaned-auth"

/**
 * Účty, u kterých přihlášení existuje, ale zákazník k němu chybí.
 *
 * GET vrátí nálezy, POST provede jednu opravu. Rozhoduje obsluha — proč to
 * nedělá automatika, je vysvětlené v `lib/orphaned-auth.ts`.
 */
export const PostOsireleUctySchema = z.object({
  identityId: z.string().min(1),
  oprava: z.enum(["obnovit", "prepojit", "uvolnit"]),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    res.json({ ucty: await najdiOsireleUcty(req.scope) })
  } catch (chyba: any) {
    /* Přehled tenhle blok volá při každém otevření. Kdyby se tu vyhodila
       výjimka, spadla by celá úvodní stránka administrace kvůli kontrole,
       která je jen pojistkou — proto prázdný seznam a hlášení do logu. */
    logger.error(
      `[osiřelé účty] kontrola selhala: ${chyba?.message ?? chyba}`
    )
    res.json({ ucty: [], chyba: "Kontrolu se nepodařilo provést." })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { identityId, oprava } = req.validatedBody as {
    identityId: string
    oprava: Oprava
  }

  try {
    const zprava = await spravUcet(req.scope, identityId, oprava)
    logger.info(`[osiřelé účty] ${oprava} na ${identityId}: ${zprava}`)
    res.json({ zprava })
  } catch (chyba: any) {
    logger.error(
      `[osiřelé účty] oprava ${oprava} na ${identityId} selhala: ${chyba?.message ?? chyba}`
    )
    res.status(500).json({ message: "Opravu se nepodařilo provést." })
  }
}
