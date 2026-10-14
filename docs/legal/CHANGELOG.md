# Právní soulad — co se změnilo a proč

Větev `legal/compliance-2026`, podle `LEGAL_AUDIT.md` (14. 10. 2026). Odkazy na paragrafy:
OZ = zákon č. 89/2012 Sb., ZOS = zákon č. 634/1992 Sb.

## Jádro

- **Právní dokumenty přesunuty z CMS do verzovaného registru v repu**
  (`storefront/src/lib/legal/`). CMS (ValeCMS) přepisoval kapitoly podle pořadí a měl strop
  1000 znaků na kapitolu; nové znění by na webu přebilo staré z CMS a nedalo by se doložit,
  jaké znění platilo pro konkrétní objednávku (§ 1827 odst. 2 OZ, § 1826a OZ). Dokumenty mají
  verzi = datum účinnosti, staré verze zůstávají na vlastní URL.
- Údaje o prodávající na jednom místě (`facts.ts`); chybějící údaje se vykreslují jako
  zvýrazněné `[[DOPLNIT: …]]`, nikdy jako odhad.
- Doslovný přepis vzorového poučení a formuláře pro odstoupení z přílohy NV 29/2023 Sb. ve znění
  NV 66/2026 Sb. (`docs/legal/sources/nv-29-2023-priloha.md`).
