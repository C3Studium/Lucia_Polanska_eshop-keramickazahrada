/*
 * Scroll cue — kapsle myši s kolečkem.
 *
 * Celá animace je v style.scss jako CSS keyframes (5. 11. 2026). Dřív ji
 * počítal framer v JavaScriptu a každý snímek zapisoval styl; keyframes
 * s transformem běží na kompozitoru a hlavní vlákno nechávají v klidu.
 *
 * Dráha kolečka je procento VLASTNÍ výšky kolečka, ne pixely. Translate
 * v procentech se počítá z vlastního border-boxu prvku, takže stačí poměr:
 * kolečko je 18 % šířky kapsle při tvaru 1:2, jeho výška je tedy
 * 0.36 × šířka kapsle = 0.216 × výška kapsle, a dráha se přeškáluje
 * s clampem ve style.scss sama, na každém viewportu.
 *
 * Klid = -115 % výšky kolečka (horní třetina kapsle), dolní bod = klid + 65 %
 * = -50 %. 65 % výšky kolečka = 14 % výšky kapsle — přesně dráha původního
 * žebříku na 1440×900 (9.5px z 67.5px).
 */
export default function MouseAnim() {
    return (
        <div className="mouse-anim">
            <div className="mouse-anim__border"></div>
            <div className="mouse-anim__wheel" />
        </div>
    );
}
