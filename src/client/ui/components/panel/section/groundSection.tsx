import SubPanelSection from "./subPanelSection";

// The ground's entry in a room's settings (see CustomizeRoomPanel), which raises GroundPanel.
export default function GroundSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Ground" buttonId={GROUND_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const GROUND_BUTTON_ID = "groundButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
