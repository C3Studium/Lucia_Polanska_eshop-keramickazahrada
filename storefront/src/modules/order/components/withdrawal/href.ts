/**
 * Odkaz na stránku odstoupení s podepsaným tokenem (bez tokenu ji otevře jen
 * přihlášený vlastník). Ve vlastním souboru: \`entry.tsx\` je klientská
 * komponenta a serverové potvrzení objednávky z ní funkci volat nemůže.
 */
export const withdrawalHref = (orderId: string, token?: string | null) =>
  token
    ? `/order/${orderId}/odstoupeni?token=${encodeURIComponent(token)}`
    : `/order/${orderId}/odstoupeni`
