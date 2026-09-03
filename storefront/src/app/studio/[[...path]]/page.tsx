// Kde Studio na tomhle webu bydlí.
//
// Stránka zůstává serverová a nese metadata; Studio uvnitř je klientské.
// Obráceně to nejde: soubor s `use client` nesmí exportovat `metadata`.
import { StudioClient } from '@c3studium/valecms/studio/appPage.jsx'

export const metadata = {
    title: 'Studio',
    // Administrace za přihlášením nemá co dělat ve vyhledávači.
    robots: { index: false, follow: false },
}

export default function StudioPage() {
    return <StudioClient title="Studio" />
}
