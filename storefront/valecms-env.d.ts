/// <reference types="@c3studium/valecms" />

// Tenhle soubor jen říká TypeScriptu, aby načetl deklarace z balíčku.
// Podcesty (`@c3studium/valecms/site`, `…/core`…) se importují přímo a ambientní
// deklarace by se bez tohohle odkazu nemusely načíst vůbec. Stejný trik dělá
// Next se svým next-env.d.ts.
//
// Needituj — přepíše se při dalším `valecms init`.
