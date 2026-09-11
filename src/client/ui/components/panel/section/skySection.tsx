import SubPanelSection from "./subPanelSection";

// The sky's entry in a room's settings (see CustomizeRoomPanel), which raises SkyPanel.
export default function SkySection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Sky" buttonId={SKY_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const SKY_BUTTON_ID = "skyButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
