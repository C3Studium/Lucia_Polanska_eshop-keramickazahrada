/**
 * Otevření podacího štítku v novém okně.
 *
 * nAPI vrací PDF štítku base64 přímo v odpovědi podání — u dopravce žádná
 * URL neexistuje. Base64 se tu promění v blob, takže otevření nepotřebuje
 * žádné přihlášení v novém tabu (a starší štítky s URL dál fungují).
 */
export type StitekZasilky = {
  url: string;
  tracking_number: string | null;
  pdf_base64?: string | null;
};

export const otevritStitek = (stitek: StitekZasilky): boolean => {
  if (stitek.pdf_base64) {
    try {
      const bytes = Uint8Array.from(atob(stitek.pdf_base64), (znak) =>
        znak.charCodeAt(0)
      );
      const blob = new Blob([bytes], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      // Prohlížeč si obsah drží, dokud tab žije; URL po chvíli uklidíme.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return true;
    } catch {
      // Poškozené base64 — spadneme na URL větev níž, ať se aspoň něco otevře.
    }
  }
  if (stitek.url) {
    window.open(stitek.url, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
};
