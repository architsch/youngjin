// The sign's two colors, its disc's and its stroke's: the count's own green, or the yellow of what something pays.
const COLORS = {
    green: {disc: "#c8f2c4", sign: "#0f5c2a"},
    yellow: {disc: "#f6e59a", sign: "#6a4d06"},
};

export default function DollarSignIcon({color = "green"}: {color?: keyof typeof COLORS})
{
    // A "$" well inside its circle, in its own color whatever color surrounds it.
    return <svg viewBox="8.8 2.8 14.4 14.4" className="w-full h-full">
        <circle cx="16" cy="10" r="7.2" fill={COLORS[color].disc}/>
        <g transform="translate(16 10) scale(0.62) translate(-16 -10)" fill="none" stroke={COLORS[color].sign} strokeLinecap="round">
            <path d="M19.2 6.9 C18.5 5.7 17.3 5.3 16 5.3 C14.2 5.3 12.9 6.2 12.9 7.6 C12.9 9.1 14.4 9.6 16 10 C17.6 10.4 19.2 10.9 19.2 12.4 C19.2 13.8 17.8 14.7 16 14.7 C14.6 14.7 13.4 14.2 12.7 13"
                strokeWidth="2.2"/>
            <line x1="16" y1="3.6" x2="16" y2="16.4" strokeWidth="1.8"/>
        </g>
    </svg>
}
