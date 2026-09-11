import SubPanelSection from "./subPanelSection";

// The ambient light's entry in a room's settings (see CustomizeRoomPanel), which raises
// AmbientLightPanel.
export default function AmbientLightSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Ambient Light" buttonId={AMBIENT_LIGHT_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const AMBIENT_LIGHT_BUTTON_ID = "ambientLightButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
