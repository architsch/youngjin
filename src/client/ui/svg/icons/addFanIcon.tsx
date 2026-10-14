const BLADE_PATH = "M10 14 C 5.6 12.4, 6.4 7, 11.4 6.6 C 13.2 9.4, 12.6 12.4, 10 14 Z";

export default function AddFanIcon()
{
    // Three swept blades about a hub.
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <g className="stroke-violet-300 fill-violet-300/40">
            <path d={BLADE_PATH}/>
            <path d={BLADE_PATH} transform="rotate(120 10 14)"/>
            <path d={BLADE_PATH} transform="rotate(240 10 14)"/>
        </g>
        <line x1="15" y1="4" x2="23" y2="4"/>
        <line x1="19" y1="0" x2="19" y2="8"/>
    </svg>
}
