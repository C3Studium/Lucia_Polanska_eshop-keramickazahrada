/**
 * Kořenová autorita České pošty — bez ní se na ostré prostředí nedovoláme.
 *
 * `b2b.postaonline.cz` nemá certifikát od veřejné autority: řetěz je
 * `PostSignum Public CA 5` → `PostSignum Root QCA 4`, a ten kořen v seznamu,
 * který si Node nese s sebou, není. Spojení proto skončí na
 * `self-signed certificate in certificate chain` dřív, než dojde na podpis —
 * tedy stejně jako kdyby byl špatně secret, jen o krok dřív a s matoucí
 * hláškou. Ověřeno voláním 6. 11. 2026.
 *
 * Vypnout kontrolu by bylo o řádek kratší a o hodně horší: certifikát je
 * jediné, co brání tomu, aby data zásilek odcházela někomu jinému. Přidává se
 * proto ta jedna chybějící autorita a ověřuje se dál.
 *
 * Kde se to vzalo: https://www.postsignum.cz/crt/psrootqca4.crt (staženo přes
 * veřejně důvěryhodné TLS) a otisk porovnán s kořenem, který předkládá sám
 * server:
 *
 *   SHA-256  AC:7F:78:62:E6:85:C7:A7:D9:82:6A:58:EA:32:D1:83
 *            D4:89:3F:CC:8F:8F:D6:D9:00:C9:76:9A:98:7E:77:F0
 *
 * Platnost kořene končí 26. 7. 2038. Je zapsaný tady v kódu, a ne jako soubor
 * vedle, protože build backendu do `.medusa/server` bere jen to, co projde
 * přes TypeScript — soubor `.pem` by se do kontejneru nedostal.
 */
export const POSTSIGNUM_ROOT_QCA4 = `-----BEGIN CERTIFICATE-----
MIIHMDCCBRigAwIBAgICD6AwDQYJKoZIhvcNAQENBQAwZTELMAkGA1UEBhMCQ1ox
FzAVBgNVBGETDk5UUkNaLTQ3MTE0OTgzMR0wGwYDVQQKDBTEjGVza8OhIHBvxaF0
YSwgcy5wLjEeMBwGA1UEAxMVUG9zdFNpZ251bSBSb290IFFDQSA0MB4XDTE4MDcy
NjA5NTYwOFoXDTM4MDcyNjA5NTYwOFowZTELMAkGA1UEBhMCQ1oxFzAVBgNVBGET
Dk5UUkNaLTQ3MTE0OTgzMR0wGwYDVQQKDBTEjGVza8OhIHBvxaF0YSwgcy5wLjEe
MBwGA1UEAxMVUG9zdFNpZ251bSBSb290IFFDQSA0MIICIjANBgkqhkiG9w0BAQEF
AAOCAg8AMIICCgKCAgEAxmaNgqB+vosiJXgQwAiLmhl/1a0AFA5k3t4hcB3IYUL6
VRyLnjvonYJHfLuOAn6dS9zi++i3PZkRqB1xHkfCJNFClXxk4tfbmhDeTJ6mQjx+
fu2wywPtxrtd/Dn0xO6Kc7Mb/ffwaFSSh6f0bZt61RLov4JPNKOvhq9qjOQgjGZy
rBGIle60IppJm8bl0A5bmRL4FQygNwIascskyl0Vy69LHx4CNUIwtgN7b1s++leV
NpETeLFpCtPdLoxEswg/kJuMRf8XaBZmGJIYSArCKIVYyC/gO7PRUmiwv2yLYdm7
9xvCd1xoIXHqPd23bqQs4vr5O0QzmYjU6kZbuLV8GIBuVFOH35tjtOUxMrZ+2Dja
yuNcNc7OGnAoofqXvD5dfp5snqP+ZZYlVPXi9Y+N5e4PLt0rdud+uiLDW27ekSXR
hvJMBxJxSb8XFgKPUbMnatCNTmtFaD9nfv5Uhlx7kfn2XzO61rnzuf2CcgSlNiT7
TQSXepGBIPjg+5QYJlhacazdL7JHdUTjJqYVbnA/Zje68lzDMfL1wDSMExh2HWGL
VGJZj6inVKBZB+4suo7FtdqyzT9AmVW9a1ekPlk7g/s93freyoA/EIwHy/Hvosk7
VivLdYwU8IdUbX8JMA1QaxVgkMe6F7A7EKvFujf1L/nAnPt5CC0A2niFS+XBMikC
AwEAAaOCAegwggHkMIGlBgNVHR8EgZ0wgZowMaAvoC2GK2h0dHA6Ly9jcmwucG9z
dHNpZ251bS5jei9jcmwvcHNyb290cWNhNC5jcmwwMqAwoC6GLGh0dHA6Ly9jcmwy
LnBvc3RzaWdudW0uY3ovY3JsL3Bzcm9vdHFjYTQuY3JsMDGgL6AthitodHRwOi8v
Y3JsLnBvc3RzaWdudW0uZXUvY3JsL3Bzcm9vdHFjYTQuY3JsMIHVBgNVHSAEgc0w
gcowgccGBFUdIAAwgb4wgbsGCCsGAQUFBwICMIGuGoGrVGVudG8gY2VydGlmaWth
dCBwcm8gZWxla3Ryb25pY2tvdSBwZWNldCBieWwgdnlkYW4gdiBzb3VsYWR1IHMg
bmFyaXplbmltIEVVIGMuIDkxMC8yMDE0LlRoaXMgaXMgYSBjZXJ0aWZpY2F0ZSBm
b3IgZWxlY3Ryb25pYyBzZWFsIGFjY29yZGluZyB0byBSZWd1bGF0aW9uIChFVSkg
Tm8gOTEwLzIwMTQuMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYDVR0PAQH/BAQDAgEG
MB8GA1UdIwQYMBaAFJMYNh+paXBRNapPP6yNUH4mBSkKMB0GA1UdDgQWBBSTGDYf
qWlwUTWqTz+sjVB+JgUpCjANBgkqhkiG9w0BAQ0FAAOCAgEAO01Radk3mUuojS9G
+JksIhH6qWebQZg0UpN2v5H22JEI+HfBat2ept+TMmB9o9D51rhRoC8Y85yS0WB9
JJCMauZcF77PjF2LTT4pO/bvEgI3ahrjf63iJiTNHFNztqyzKuOBGNAqQ2S0bV9a
GNcAqvSbF7gJbyDE/74EFz9Qq0BHnmQJH4xQN3uzGJPM8XkRvxRgj+SD/tXnqGGI
PWurj4J6GGBsIfr6ecYReq9B2syPC9E4uB8qFfvEQunA9NJ2mLLoCqtTICU3/t95
IvUVOBl1o6q+QmYEfmUg2qJuIBbtXb5WhQ5hkRfIBFlQ8upyZQZaXXqlmJmjZJzk
dNk7hstyRP7BhVdgyCyHZtBTX2p+cEO644M0fzw58ORo0s1zvG/tooRm9tWg+5ry
hLmG2Xcrll4V+QxjFgmG8wFakq2AqNq4W7PxDHiAl/xqnh/kNgwkI+7VoTHrdqrz
CSbyAwzjDd9T2kgRxQG8U6vfuEt84iNtySCdmp6pWPNPkfjNOGCQEv7GamcUlHw4
11SfvD70YnW5nxgNdmqxcDcUtxzGngcXtFa/qAjxWR7TS25ESNkzzKAZELQs9ORy
DLQkgzbYhCLdvDolc33xA0+Ge1bjzpH6PbpGDZxmWKTFM2ZJQQYNvWH7P55T3pbE
53TUes0DYl+ICmA+jPmN4YzcGrI=
-----END CERTIFICATE-----
`
