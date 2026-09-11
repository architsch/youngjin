import SubPanelSection from "./subPanelSection";

// The clouds' entry in a room's settings (see CustomizeRoomPanel), which raises CloudsPanel.
export default function CloudsSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Clouds" buttonId={CLOUDS_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const CLOUDS_BUTTON_ID = "cloudsButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
