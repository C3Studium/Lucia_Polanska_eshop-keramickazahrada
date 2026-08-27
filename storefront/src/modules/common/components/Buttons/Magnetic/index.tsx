"use client";
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useCallback, useRef } from 'react';

import { useDeviceTier } from '@lib/hooks/use-device-tier';

const SPRING = { damping: 5, stiffness: 100, mass: 0.5 } as const;
const RELATIVE = { zIndex: 50, position: 'relative' } as const;

export default function Magnetic({ children, sensitivity = 0.1 }: { children: React.ReactNode; sensitivity?: number }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const { isTouch } = useDeviceTier();

    /*
     * Motion values rather than state. This used to call setState on every mousemove, which
     * re-rendered the component — and everything it wraps — once per pointer event, at up to the
     * pointer's full report rate. A motion value writes straight to the transform and never
     * touches React's render cycle.
     */
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, SPRING);
    const springY = useSpring(y, SPRING);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const el = ref.current;
        if (!el) return;
        const { width, height, top, left } = el.getBoundingClientRect();
        x.set((e.clientX - (left + width / 2)) * sensitivity);
        y.set((e.clientY - (top + height / 2)) * sensitivity);
    }, [sensitivity, x, y]);

    const reset = useCallback(() => {
        x.set(0);
        y.set(0);
    }, [x, y]);

    /*
     * The whole effect is the element leaning toward the cursor. On a touch device there is no
     * cursor, so there is nothing to lean toward — it is dead weight, not a degraded experience.
     */
    if (isTouch) {
        return <div className='magnetic' style={RELATIVE}>{children}</div>;
    }

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={reset}
            style={{ x: springX, y: springY, ...RELATIVE }}
            className='magnetic'
        >
            {children}
        </motion.div>
    );
}
