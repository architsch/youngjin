// A progress bar sized in em, so it scales with the surrounding font.
export default function ProgressBar({ value, additionalClassNames = "" }: Props)
{
    // Inline style: a continuous value.
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
