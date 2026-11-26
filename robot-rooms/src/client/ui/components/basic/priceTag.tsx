import DollarSignIcon from "../../svg/icons/dollarSignIcon";

// What something costs, in dollars: the count's own sign, and the number beside it. gain: what it pays instead, with a
// plus before it, and in yellow to tell it from a price. inButton: beside a button's own words, as large as they are
// and in their color.
export default function PriceTag({dollars, gain = false, inButton = false, additionalClassNames = ""}: Props)
{
    // Not the UI's monospace, whose zero is slashed.
    const colorClassName = inButton ? "" : gain ? "text-yellow-300" : "text-green-300";
    const textClassNames = `font-sans font-bold leading-none ${inButton ? "text-base" : "text-xs"} ${colorClassName}`;
    return <div className={`flex flex-row items-center gap-0.5 pointer-events-none select-none ${additionalClassNames}`}>
        {gain && <span className={textClassNames}>+</span>}
        <div className={`${inButton ? "size-4.5" : "size-3.5"} shrink-0`}><DollarSignIcon color={gain ? "yellow" : "green"}/></div>
        <span className={textClassNames}>{dollars}</span>
    </div>;
}

interface Props
{
    dollars: number;
    gain?: boolean;
    inButton?: boolean;
    additionalClassNames?: string;
}
