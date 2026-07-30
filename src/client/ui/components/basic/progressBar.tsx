// A horizontal bar whose filled portion shows how far along an operation is. Both the height and
// the corner rounding are given in em, so the bar takes its proportions from the text it sits under
// however large the surrounding element's font has been scaled.
export default function ProgressBar({ value, additionalClassNames = "" }: Props)
{
    // The fill has to be an inline style: it is a continuously varying length, not one of a
    // handful of states a utility class could stand for.
    const filledPercentage = Math.min(1, Math.max(0, value)) * 100;

    return <div className={`w-full h-[0.35em] rounded-[0.175em] overflow-hidden bg-white/25 ${additionalClassNames}`}>
        <div className="h-full rounded-[0.175em] bg-current" style={{ width: `${filledPercentage}%` }}></div>
    </div>
}

interface Props
{
    value: number; // in [0, 1]
    additionalClassNames?: string;
}
