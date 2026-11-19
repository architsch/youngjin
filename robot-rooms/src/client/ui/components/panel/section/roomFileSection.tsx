import SubPanelSection from "./subPanelSection";
import MagnifierIcon from "../../../svg/icons/magnifierIcon";

// The room file's entry in an admin's room settings (see CustomizeRoomPanel), which raises RoomFilePanel.
export default function RoomFileSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Local Backup" buttonId={ROOM_FILE_BUTTON_ID} icon={<MagnifierIcon/>}
        open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const ROOM_FILE_BUTTON_ID = "roomFileButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
