import { Tools } from "@medusajs/icons";
import MadeToOrderPage from "./produkty/page";

/**
 * Produkty na zakázku — a top-level item rather than a section.
 *
 * Zakázková výroba used to be a section with two children. The commissions
 * queue moved into Přehled, where the rest of the day's work lives, which left
 * this page alone; a parent item wrapping one child is noise, so the section
 * collapsed into the page itself.
 *
 * This is configuration, not work: it decides *which* products are made to
 * order, how long they take and what deposit they carry. That is why it did
 * not follow Zakázky into Přehled.
 *
 * `/zakazkova-vyroba/produkty` still renders the same component, so older
 * links keep working.
 */
const ProduktyNaZakazkuPage = () => <MadeToOrderPage />;

/**
 * **No sidebar entry.** Reached from Přehled → Produkty. The sidebar is down
 * to the five places she navigates *to*; everything she works *in* lives
 * under Přehled.
 */

export default ProduktyNaZakazkuPage;
