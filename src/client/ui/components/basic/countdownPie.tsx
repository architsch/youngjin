import { useEffect, useRef } from "react";

// A pie of the time left, eaten away by a hand sweeping clockwise from the top until none is left. Drawn as one circle's
// dash, which the browser animates without a render a frame.
export default function CountdownPie({ startedAt, durationMs, additionalClassNames = "" }: Props)
{
    const wedgeRef = useRef<SVGCircleElement>(null);

    useEffect(() => {
        const animation = wedgeRef.current?.animate(
            [{strokeDashoffset: "0px"}, {strokeDashoffset: `${-CIRCUMFERENCE}px`}],
            {duration: durationMs, fill: "forwards"});
        if (animation)
            animation.currentTime = Math.max(0, Date.now() - startedAt);
        return () => animation?.cancel();
    }, [startedAt, durationMs]);

    // Flat on purpose, unlike the wells that hold values elsewhere (see the depth rules in input.css), with a thin dark
    // ring round the wedge. A stroke as wide as the circle's diameter fills the disc, and its dash is the wedge, starting
    // at the top.
    return <svg viewBox="0 0 20 20"
        className={`shrink-0 size-5.5 p-px rounded-full bg-black/40 text-green-600 ${additionalClassNames}`}>
        <circle ref={wedgeRef} cx="10" cy="10" r={RADIUS} fill="none" stroke="currentColor" strokeWidth={2 * RADIUS}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} transform="rotate(-90 10 10)"/>
    </svg>;
}

const RADIUS = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props
{
    // When the time started, by Date.now().
    startedAt: number;
    durationMs: number;
    additionalClassNames?: string;
}
