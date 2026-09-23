import LabelCompositionConstants from "../compositionConstants/labelCompositionConstants";
import createFramedPanelCodec from "./framedPanelCompositionCodec";

// A label's plaque and the frame around it (see createFramedPanelCodec), built as a canvas's board is.
// Nothing stored is lettering straight on the wall; a seeded default is framed.
export const LabelCompositionCodec = createFramedPanelCodec({
    colorSlots: ["frame", "inner"],
    presets: LabelCompositionConstants.presets,
    framedWhenFlagsMissing: true,
    framedByDefault: true,
    builderId: "PanelBoard_0",
});
