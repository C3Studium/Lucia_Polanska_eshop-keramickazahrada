import { MedusaService } from "@medusajs/framework/utils"
import NewsletterSubscriber from "./models/newsletter-subscriber"

class NewsletterModuleService extends MedusaService({
  NewsletterSubscriber
}) {
}

export default NewsletterModuleService
