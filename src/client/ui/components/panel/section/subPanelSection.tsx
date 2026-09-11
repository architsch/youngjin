import Text from "../../basic/text";
import IconButton from "../../input/iconButton";
import MagnifierIcon from "../../../svg/icons/magnifierIcon";

// One entry in a row that names settings rather than laying them out — a room's (see
// CustomizeRoomPanel): the setting's name, and beside it the toggle that raises the panel holding its
// controls, hung just above the row from the toggle itself (see ScrollPanel), or lowers it again. The
// toggle is lit while its panel is up.
//
// The entry is no taller than its toggle, since the whole point of naming the settings is a row that
// covers as little of the room as it can. So the name is written beside the toggle rather than over
// it, on one line, in the largest type that still fits within the toggle's height.
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
