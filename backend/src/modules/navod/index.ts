import { Module } from "@medusajs/framework/utils"
import NavodModuleService from "./service"

/**
 * Návod (19. 11. 2026): krátké GIFy „jak se to dělá" k otazníkům v adminu
 * a v obchodě. Texty jsou v kódu (admin/lib/navod-katalog.ts, storefront
 * lib/navod), tady je jen klíč → nahraný GIF, aby šel klip přetočit bez
 * nasazení. Nahrává `tools/navod` (POST /admin/navod/klipy).
 */
export const NAVOD_MODULE = "navod"

export default Module(NAVOD_MODULE, {
  service: NavodModuleService,
})
