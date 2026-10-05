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

const base64NaBlob = (base64: string): Blob => {
  const bytes = Uint8Array.from(atob(base64), (znak) => znak.charCodeAt(0));
  return new Blob([bytes], { type: "application/pdf" });
};

export const otevritStitek = (stitek: StitekZasilky): boolean => {
  if (stitek.pdf_base64) {
    try {
      const objectUrl = URL.createObjectURL(base64NaBlob(stitek.pdf_base64));
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

/**
 * Stáhne štítek jako PDF pod konkrétním názvem (`Stitek-Jmeno-Prijmeni-0026.pdf`),
 * ať je soubor dohledatelný. Z base64 (spolehlivé, bez CORS); když chybí, spadne
 * na URL z úložiště.
 */
export const stahnoutStitek = (
  stitek: StitekZasilky,
  filename: string
): boolean => {
  const kliknoutKeStazeni = (href: string, revokovat: boolean) => {
    const odkaz = document.createElement("a");
    odkaz.href = href;
    odkaz.download = filename;
    odkaz.rel = "noopener,noreferrer";
    document.body.appendChild(odkaz);
    odkaz.click();
    odkaz.remove();
    if (revokovat) {
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    }
  };

  if (stitek.pdf_base64) {
    try {
      const objectUrl = URL.createObjectURL(base64NaBlob(stitek.pdf_base64));
      kliknoutKeStazeni(objectUrl, true);
      return true;
    } catch {
      // Spadneme na URL níž.
    }
  }
  if (stitek.url) {
    // Jiná doména (MinIO): atribut download se nemusí ctít, ale otevře to.
    kliknoutKeStazeni(stitek.url, false);
    return true;
  }
  return false;
};

export type VysledekSdileni = "shared" | "unsupported" | "error";

/**
 * Sdílí štítek přes systémové menu telefonu (`navigator.share` se souborem) —
 * odtud jde rovnou vytisknout, poslat, uložit. Na zařízení bez podpory vrátí
 * „unsupported", ať volající nabídne stažení.
 */
export const sdiletStitek = async (
  stitek: StitekZasilky,
  filename: string
): Promise<VysledekSdileni> => {
  if (!stitek.pdf_base64) {
    return "unsupported";
  }
  const nav = navigator as Navigator & {
    canShare?: (data?: unknown) => boolean;
    share?: (data?: unknown) => Promise<void>;
  };
  try {
    const soubor = new File([base64NaBlob(stitek.pdf_base64)], filename, {
      type: "application/pdf",
    });
    if (!nav.share || !nav.canShare || !nav.canShare({ files: [soubor] })) {
      return "unsupported";
    }
    await nav.share({ files: [soubor], title: filename });
    return "shared";
  } catch (chyba) {
    // Zavření systémového okna sdílení není chyba.
    if (chyba instanceof DOMException && chyba.name === "AbortError") {
      return "shared";
    }
    return "error";
  }
};
