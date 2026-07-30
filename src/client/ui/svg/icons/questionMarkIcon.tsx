export default function QuestionMarkIcon()
{
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        {/* The glyph is drawn well inside its box, which leaves it looking lost in a button barely
            bigger than the glyph itself — so it is blown up about the center of that box. */}
        <g transform="translate(12 12) scale(1.6) translate(-12 -12)">
            <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75"/>
            <path d="M12 17.25h.008v.008H12v-.008Z"/>
        </g>
    </svg>
}
