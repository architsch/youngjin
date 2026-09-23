import CanvasCompositionConstants from "../compositionConstants/canvasCompositionConstants";
import createFramedPanelCodec from "./framedPanelCompositionCodec";

// A canvas's frame and the surface inside it (see createFramedPanelCodec). Nothing stored is frameless, with
// the first finish kept for a frame turned on; a seeded default is framed.
export const CanvasCompositionCodec = createFramedPanelCodec({
    colorSlots: ["frame", "inner"],
    presets: CanvasCompositionConstants.presets,
    framedWhenFlagsMissing: true,
    framedByDefault: true,
    builderId: "PanelBoard_0",
});
