"use client";
import React from 'react';
import { Easing, motion } from 'framer-motion';

/*
 * Dráha kolečka je procento VLASTNÍ výšky kolečka, ne pixely.
 *
 * Předtím tu byla tabulka dvanácti viewportů s px hodnotami (hugeh -20/-10,
 * lgh -17/-7.5, mdh -10/-5 …). Ta čísla ale nebyla nezávislá — každé z nich bylo
 * zhruba stejný násobek výšky kolečka, tedy dvanáct opisů jedné geometrie.
 * Translate v procentech se počítá z vlastního border-boxu prvku, takže stačí
 * poměr: kolečko je 18 % šířky kapsle při tvaru 1:2, jeho výška je tedy
 * 0.36 × šířka kapsle = 0.216 × výška kapsle, a dráha se přeškáluje s clampem
 * ve style.scss sama, na každém viewportu a i mezi stopy.
 *
 * REST = -115 % výšky kolečka posadí kolečko do horní třetiny kapsle: střed
 * kapsle − 1.15 × 0.216 = 24.8 % výšky kapsle nad středem, tedy horní hrana
 * kolečka ~14.5 % pod horní hranou kapsle.
 * TRAVEL = 65 % výšky kolečka = 0.65 × 0.216 = 14.0 % výšky kapsle — přesně
 * ta dráha, kterou měl původní žebřík na 1440×900 (9.5px z 67.5px = 14.1 %).
 * Spodní bod se dopočítá, neopisuje.
 */
const WHEEL_REST_PCT = -115;
const WHEEL_TRAVEL_PCT = 65;
const WHEEL_LOW_PCT = WHEEL_REST_PCT + WHEEL_TRAVEL_PCT;

// Konstantní, takže se nevyrábí při každém renderu. Všechny tři keyframy mají
// stejný tvar výrazu (procento), aby zůstaly interpolovatelné.
const wheelAnimation = {
    initial: { y: `${WHEEL_REST_PCT}%` },
    animate: {
        y: [`${WHEEL_REST_PCT}%`, `${WHEEL_LOW_PCT}%`, `${WHEEL_REST_PCT}%`],
        transition: {
            duration: 2,
            repeat: Infinity,
            ease: [0.76, 0, 0.24, 1] as Easing,
        }
    }
};

export default function MouseAnim() {
    // Žádný state, žádný resize listener, žádný remount přes key: velikost řeší
    // clamp v CSS a dráha je na velikosti odvozená. Per-frame práci drží framer
    // v motion values, React o ní neví.
    return (
        <div className="mouse-anim">
            <div className="mouse-anim__border"></div>
            <motion.div
                className="mouse-anim__wheel"
                initial="initial"
                animate="animate"
                variants={wheelAnimation}
            />
        </div>
    );
}
