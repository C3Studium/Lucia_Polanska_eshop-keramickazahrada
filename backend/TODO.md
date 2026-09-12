Kde: portál ComGate → přihlásit se → nastavení vašeho e-shopu (bývá to „Obchody" / „Nastavení obchodu"). Hledáte pole, které se jmenuje něco jako „URL pro oznámení o platbě" nebo „Notifikační URL" — v angličtině „Notification / callback URL". Není to totéž co návratové adresy (kam se vrací zákazník) — ty se posílají z našeho kódu a nastavovat se nemusí.

Co tam vložit — přesně tohle:


https://dev.matejforejt.com/hooks/payment/pp_comgate_comgate
Ověřil jsem, že ta adresa zvenčí odpovídá, jen ji zatím nikdo nevolá. Až tam bude, poznáte to hned — v logu backendu se objeví řádek [comgate] oznámení přijato: transId=… stav=…. Řekněte a zkontroluju to za vás.

Kdyby to pole v portálu nebylo, píše se o něj podpoře ComGate — u některých účtů ho nastavují oni.