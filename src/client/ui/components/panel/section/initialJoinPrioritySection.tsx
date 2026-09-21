import SubPanelSection from "./subPanelSection";

// The join priority's entry in a hub's settings (see CustomizeRoomPanel), which raises
// InitialJoinPriorityPanel.
export default function InitialJoinPrioritySection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Join Priority" buttonId={INITIAL_JOIN_PRIORITY_BUTTON_ID}
        open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const INITIAL_JOIN_PRIORITY_BUTTON_ID = "initialJoinPriorityButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
