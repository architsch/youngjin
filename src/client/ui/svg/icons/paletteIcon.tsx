export default function PaletteIcon()
{
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        {/* The palette's outline: a rounded body with a thumb-hole bitten out of its lower right. */}
        <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.75-.85 1.75-1.75 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-3.9-4-7.25-9-7.25Z"/>
        {/* The dabs of paint on it. */}
        <circle cx="7.75" cy="12" r="1.15" fill="currentColor" stroke="none"/>
        <circle cx="9.5" cy="8" r="1.15" fill="currentColor" stroke="none"/>
        <circle cx="14" cy="7.25" r="1.15" fill="currentColor" stroke="none"/>
        <circle cx="17.25" cy="10.5" r="1.15" fill="currentColor" stroke="none"/>
    </svg>
}
