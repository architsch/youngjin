// An animated finger swiping from side to side, with a thin double-headed arrow tracing its
// trajectory. Drawn entirely with inline SVG — the motion uses SVG's native SMIL elements — so it
// is self-contained and needs no image assets or extra CSS keyframes.
export default function DragSidewaysDiagram({ additionalClassNames = "" }: Props)
{
    return <svg viewBox="0 0 200 120" fill="none" className={additionalClassNames}>
        {/* Trajectory: a thin arrow pointing both ways, which the finger traces back and forth. */}
        <g stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
            <line x1="34" y1="36" x2="166" y2="36"/>
            <path d="M52 22 L32 36 L52 50"/>
            <path d="M148 22 L168 36 L148 50"/>
        </g>
        {/* Animated finger (Material 'touch_app' glyph): swipes left -> right and back, forever. */}
        <g>
            <animateTransform attributeName="transform" type="translate"
                calcMode="spline" dur="2.4s" repeatCount="indefinite"
                keyTimes="0; 0.4; 0.5; 0.9; 1"
                keySplines="0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1; 0 0 1 1"
                values="40,0; 140,0; 140,0; 40,0; 40,0"/>
            <g transform="translate(-11 24) scale(2)">
                <path fill="#fef3c7" stroke="#b45309" strokeWidth="0.6"
                    d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6C13 6.67 12.33 6 11.5 6S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/>
            </g>
        </g>
    </svg>;
}

interface Props
{
    additionalClassNames?: string;
}
