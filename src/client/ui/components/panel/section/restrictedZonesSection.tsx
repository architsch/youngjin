import SubPanelSection from "./subPanelSection";

// Room settings entry that raises RestrictedZonesPanel.
export default function RestrictedZonesSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Restricted Zones" buttonId={RESTRICTED_ZONES_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const RESTRICTED_ZONES_BUTTON_ID = "restrictedZonesButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
