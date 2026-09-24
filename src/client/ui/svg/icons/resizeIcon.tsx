export default function ResizeIcon()
{
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        {/* A small square grown toward a larger one. */}
        <rect x="2" y="2" width="20" height="20" rx="1" strokeDasharray="3 3"/>
        <rect x="2" y="12" width="10" height="10" rx="1"/>
        <line x1="12" y1="12" x2="19" y2="5"/>
        <polyline points="13 5 19 5 19 11"/>
    </svg>
}
