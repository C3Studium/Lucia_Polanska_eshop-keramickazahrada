import { MedusaService } from "@medusajs/framework/utils"
import NewsletterCampaign from "./models/newsletter-campaign"
import NewsletterEvent from "./models/newsletter-event"
import NewsletterSubscriber from "./models/newsletter-subscriber"

class NewsletterModuleService extends MedusaService({
  NewsletterSubscriber,
  NewsletterCampaign,
  NewsletterEvent
}) {
}

export default NewsletterModuleService
