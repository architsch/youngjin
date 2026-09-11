import SubPanelSection from "./subPanelSection";

// The fog's entry in a room's settings (see CustomizeRoomPanel), which raises FogPanel.
export default function FogSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Fog" buttonId={FOG_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const FOG_BUTTON_ID = "fogButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
