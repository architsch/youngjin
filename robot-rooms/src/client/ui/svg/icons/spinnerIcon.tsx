// A ring with a bright stretch of it, which turns where it is shown while something is awaited.
export default function SpinnerIcon()
{
    return <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className="w-full h-full animate-spin">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25"/>
        <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor"/>
    </svg>
}
