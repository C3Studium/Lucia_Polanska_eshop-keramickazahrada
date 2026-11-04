import { Link } from "react-router-dom";

/**
 * Celý řádek jako odkaz na objednávku.
 *
 * Seznamy Denní práce a Zakázky jsou dlouhé a v každém řádku se nakonec
 * stejně kliká na „Otevřít objednávku". Mířit na jedno tlačítko vpravo je
 * u řádku vysokého přes sto pixelů zbytečná přesnost — proto je odkazem celý
 * řádek a tlačítko zůstává jako viditelné vodítko (a jako cesta pro
 * klávesnici).
 *
 * ## Proč překryv, a ne `onClick` na řádku
 *
 * Tohle je opravdový `<a>` přes celou plochu: funguje prostřední tlačítko,
 * Ctrl+klik, „otevřít v novém panelu" i náhled adresy ve stavovém řádku.
 * Klikací `<div>` by nic z toho neuměl.
 *
 * Daň za to je, že se text řádku nedá označit myší — překryv chytne tah.
 * U těchhle dvou seznamů to nevadí: e-mail se posílá tlačítkem „Kontaktovat"
 * a čísla se čtou v detailu objednávky.
 *
 * ## Jak se zapojuje
 *
 * Řádek musí být `relative` (aby se překryv měl čeho chytit) a každý jeho
 * prvek, na který se dá kliknout, `relative z-10` — jinak ho překryv přikryje
 * a tlačítko přestane fungovat. Překryv sám je mimo pořadí tabulátoru
 * a skrytý čtečkám: jinak by každý řádek měl dva odkazy na totéž.
 */
export const RowLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    aria-label={label}
    aria-hidden="true"
    tabIndex={-1}
    className="absolute inset-0"
  />
);

export default RowLink;
