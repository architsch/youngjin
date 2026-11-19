export default function NewTabIcon()
{
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        {/* A page, open at its top right corner, which an arrow leaves by. */}
        <path d="M 11 5 H 6 A 1 1 0 0 0 5 6 V 18 A 1 1 0 0 0 6 19 H 18 A 1 1 0 0 0 19 18 V 13"/>
        <polyline points="14 5 19 5 19 10"/>
        <line x1="19" y1="5" x2="11" y2="13"/>
    </svg>
}
