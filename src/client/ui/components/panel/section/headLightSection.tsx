import SubPanelSection from "./subPanelSection";

// The head light's entry in a room's settings (see CustomizeRoomPanel), which raises HeadLightPanel.
export default function HeadLightSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Head Light" buttonId={HEAD_LIGHT_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const HEAD_LIGHT_BUTTON_ID = "headLightButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
