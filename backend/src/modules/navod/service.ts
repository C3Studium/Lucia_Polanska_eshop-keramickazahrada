import { MedusaService } from "@medusajs/framework/utils"
import NavodKlip from "./models/navod-klip"

class NavodModuleService extends MedusaService({
  NavodKlip,
}) {}

export default NavodModuleService
