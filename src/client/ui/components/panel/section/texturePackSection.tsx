import SubPanelSection from "./subPanelSection";

// The texture pack's entry in a room's settings (see CustomizeRoomPanel), which raises TexturePackPanel.
export default function TexturePackSection({ open, onToggle }: Props)
{
    return <SubPanelSection title="Texture Pack" buttonId={TEXTURE_PACK_BUTTON_ID} open={open} onToggle={onToggle}/>;
}

// DOM element id of the entry's toggle — what the panel it raises hangs from.
export const TEXTURE_PACK_BUTTON_ID = "texturePackButton";

interface Props
{
    open: boolean; // whether the panel this raises is up
    onToggle: () => void;
}
