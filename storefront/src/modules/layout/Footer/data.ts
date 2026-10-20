import "server-only"

import { getLegalRegistry } from "@lib/data/legal-registry"
import { getFiles } from "@lib/data/site-copy"

import { currentLegalDownloads, type FooterDownloads } from "./legal-downloads"

/**
 * „Ke stažení" v patičce — spočítané na serveru (layout) a podané patičce
 * jako prop: oficiální PDF právních dokumentů ze sloučeného registru a pod
 * nimi soubory ze Studia s „Kde se nabízí: Patička webu" (`stranka: paticka`).
 *
 * Nikdy nevyhodí — `getLegalRegistry` i `getFiles` mají zálohu (repo / prázdno).
 */
export const getFooterDownloads = async (): Promise<FooterDownloads> => {
  const [registry, files] = await Promise.all([getLegalRegistry(), getFiles("paticka")])
  return {
    legal: currentLegalDownloads(registry),
    files: files.map((file) => ({
      label: file.nazev,
      url: file.url,
      description: file.popis,
      mime: file.mime,
      bytes: file.size,
    })),
  }
}
