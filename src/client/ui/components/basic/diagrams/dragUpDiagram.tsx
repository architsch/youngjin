// An animated finger swiping from the bottom to the top of the screen, with a thin arrow
// tracing its trajectory. Drawn entirely with inline SVG — the motion uses SVG's native
// SMIL elements — so it is self-contained and needs no image assets or extra CSS keyframes.
export default function DragUpDiagram({ additionalClassNames = "" }: Props)
{
    return <svg viewBox="0 0 120 200" fill="none" className={additionalClassNames}>
        {/* Trajectory: a thin upward arrow that the finger traces. */}
        <g stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
            <line x1="60" y1="176" x2="60" y2="38"/>
            <path d="M46 56 L60 36 L74 56"/>
        </g>
        {/* Animated finger (Material 'touch_app' glyph): swipes bottom -> top, then lifts
            and resets to the bottom while invisible, looping forever. */}
        <g>
            <animateTransform attributeName="transform" type="translate"
                calcMode="spline" dur="2.1s" repeatCount="indefinite"
                keyTimes="0; 0.45; 0.6; 0.8; 1"
                keySplines="0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1; 0 0 1 1"
                values="0,145; 0,50; 0,50; 0,145; 0,145"/>
            <g>
                <animate attributeName="opacity" dur="2.1s" repeatCount="indefinite"
                    keyTimes="0; 0.45; 0.6; 0.8; 1"
                    values="1; 1; 0; 0; 1"/>
                <g transform="translate(37 0) scale(2)">
                    <path fill="#fef3c7" stroke="#b45309" strokeWidth="0.6"
                        d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6C13 6.67 12.33 6 11.5 6S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/>
                </g>
            </g>
        </g>
    </svg>;
}

interface Props
{
    additionalClassNames?: string;
}
