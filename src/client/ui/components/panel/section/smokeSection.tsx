import SubPanelSection from "./subPanelSection";

// The smoke's entry in a room's settings (see CustomizeRoomPanel), which raises SmokePanel.
export default function SmokeSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Smoke" buttonId={SMOKE_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const SMOKE_BUTTON_ID = "smokeButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
