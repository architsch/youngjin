const BLADE_PATH = "M10 14 L10 5 Q19.5 5.2 10 14 Z";

export default function AddFanIcon()
{
    // A pinwheel: four long sails about its middle.
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <g className="stroke-violet-300 fill-violet-300/40">
            <path d={BLADE_PATH}/>
            <path d={BLADE_PATH} transform="rotate(90 10 14)"/>
            <path d={BLADE_PATH} transform="rotate(180 10 14)"/>
            <path d={BLADE_PATH} transform="rotate(270 10 14)"/>
        </g>
        <line x1="15" y1="4" x2="23" y2="4"/>
        <line x1="19" y1="0" x2="19" y2="8"/>
    </svg>
}
