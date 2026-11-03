import {
  MedusaContainer
} from "@medusajs/framework/types";
import { sendRestockNotificationsWorkflow } from "../workflows/send-restock-notifications";
import { sUlohou } from "../lib/provozni-hlidka/uloha"

async function myCustomJob(container: MedusaContainer) {
  await sendRestockNotificationsWorkflow(container)
    .run()
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc hned e-mailem. */
export default sUlohou("check-restock", myCustomJob)

export const config = {
  name: "check-restock",
  schedule: "0 0 * * *",
};