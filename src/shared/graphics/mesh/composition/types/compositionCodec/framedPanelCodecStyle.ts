import FramedPanelPreset from "../compositionParams/framedPanelPreset";

// What sets one framed-panel type's codec apart from another's (see createFramedPanelCodec).
export default interface FramedPanelCodecStyle
{
    // The colors stored, in this order; "inner" only for a type whose board shows inside its band.
    colorSlots: ("frame" | "inner")[];
    // The first is what a panel storing nothing decodes to (unframed, with no margin, where it doesn't
    // say otherwise). Never reorder, since the order is what that default is.
    presets: FramedPanelPreset[];
    // Whether a string cut short before its flags keeps its frame.
    framedWhenFlagsMissing: boolean;
    // Whether a seeded default look is always framed, whatever its preset says.
    framedByDefault: boolean;
    // What builds the parts (see InstancedMeshCompositionBuilderMap).
    builderId: string;
}
