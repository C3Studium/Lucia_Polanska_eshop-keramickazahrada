import { Module } from "@medusajs/framework/utils"
import EmailOptOutModuleService from "./service"

/**
 * Odmítnuté e-maily z oprávněného zájmu (prosba o recenzi, pokles ceny
 * v oblíbených, připomenutí košíku) — viz `lib/email-optout.ts`.
 */
export const EMAIL_OPTOUT_MODULE = "emailOptOut"

export default Module(EMAIL_OPTOUT_MODULE, {
  service: EmailOptOutModuleService,
})
