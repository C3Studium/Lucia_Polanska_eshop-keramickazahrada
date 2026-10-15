import { MedusaService } from "@medusajs/framework/utils"
import EmailOptOut from "./models/email-opt-out"

class EmailOptOutModuleService extends MedusaService({
  EmailOptOut,
}) {}

export default EmailOptOutModuleService
