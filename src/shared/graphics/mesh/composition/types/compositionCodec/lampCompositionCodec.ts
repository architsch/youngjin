import LampCompositionConstants from "../compositionConstants/lampCompositionConstants";
import createFramedPanelCodec from "./framedPanelCompositionCodec";

// A lamp's optional frame around its glow (see createFramedPanelCodec). Nothing stored is the first preset.
// The glow's color is the light's, so it isn't stored.
export const LampCompositionCodec = createFramedPanelCodec({
    colorSlots: ["frame"],
    presets: LampCompositionConstants.presets,
    framedWhenFlagsMissing: false,
    framedByDefault: false,
    builderId: "LampFrame_0",
});
