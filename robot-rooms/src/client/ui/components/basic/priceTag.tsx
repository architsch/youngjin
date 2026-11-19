import DollarSignIcon from "../../svg/icons/dollarSignIcon";

// What something costs, in dollars: the count's own sign, and the number beside it.
export default function PriceTag({dollars, additionalClassNames = ""}: Props)
{
    return <div className={`flex flex-row items-center gap-0.5 pointer-events-none select-none ${additionalClassNames}`}>
        <div className="size-3.5 shrink-0"><DollarSignIcon/></div>
        {/* Not the UI's monospace, whose zero is slashed. */}
        <span className="font-sans text-xs font-bold leading-none text-green-300">{dollars}</span>
    </div>;
}

interface Props
{
    dollars: number;
    additionalClassNames?: string;
}
