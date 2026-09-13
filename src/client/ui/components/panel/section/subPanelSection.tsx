import Text from "../../basic/text";
import IconButton from "../../input/iconButton";
import MagnifierIcon from "../../../svg/icons/magnifierIcon";

// A settings row entry: name plus a toggle that raises or lowers its panel (see ScrollPanel); lit
// while open. No taller than the toggle, with the name on one line beside it.
export default function SubPanelSection({ title, buttonId, open, onToggle }: Props)
{
    return <div className="flex flex-row items-center shrink-0">
        <Text content={title} size="sm" additionalClassNames="pl-0 pr-1.5 whitespace-nowrap"/>
        <IconButton id={buttonId} icon={<MagnifierIcon/>} size="sm" highlight={open} onClick={onToggle}/>
    </div>;
}

interface Props
{
    title: string; // the setting's name
    buttonId: string; // DOM element id of the toggle — what the panel it raises hangs from
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
