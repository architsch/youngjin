import FramedPanelPreset from "../compositionParams/framedPanelPreset";
import FramedPanelCompositionConstants from "./framedPanelCompositionConstants";

// A canvas is a framed panel whose board frames its picture (see FramedPanelCompositionConstants), so the
// inner color shows around a letterboxed picture. Colors, moulding and margin vary; the shape doesn't.
const CanvasCompositionConstants = {
    // Coordinated finishes. Frames stay mid-brightness, as on doors (see DoorCompositionConstants); the
    // inner stays a quieter mid-tone, since a pale one outshines the frame and a dark one reads as a hole
    // around the picture.
    presets: [
        preset("#c9a227", "#6d5b36", 0.16, true),  // gilt, dark ochre inside
        preset("#71452b", "#bdb59d", 0.12, false), // walnut, putty inside
        preset("#74856b", "#8f9a80", 0.08, true),  // painted sage, pale sage inside
        preset("#a87545", "#c8a271", 0.10, true),  // oak, light timber inside
        preset("#647684", "#a29b86", 0.08, false), // painted slate blue, grey putty inside
        preset("#a98a3f", "#6b6659", 0.14, true),  // old gilt, grey-brown inside
        preset("#8a5f56", "#bdb59d", 0.12, false), // painted oxblood, putty inside
        preset("#d5cdb6", "#a29b86", 0.06, true),  // painted putty, grey putty inside
        preset("#845433", "#d8b98b", 0.12, true),  // dark stain, pale timber inside
        preset("#5c6f57", "#a98a3f", 0.14, false), // painted deep green, old brass inside
        preset("#b98b56", "#a29b86", 0.10, false), // pine, grey putty inside
        preset("#4e5d69", "#7d8f9c", 0.06, true),  // painted charcoal, blue-grey inside
        preset("#8a7346", "#a89263", 0.14, false), // bronze, ochre inside
        preset("#3f8f7a", "#a29b86", 0.08, true),  // verdigris, grey putty inside
        preset("#8b4818", "#c8a271", 0.10, false), // cherry, light timber inside
        preset("#5c5c5a", "#bdb59d", 0.04, false), // slim iron, putty inside
    ] as FramedPanelPreset[],
};

// A preset is a finish only: whether the frame is shown, and the margin, are left as they are.
function preset(frame: string, inner: string, mouldingThickness: number,
    mouldingIsConvex: boolean): FramedPanelPreset
{
    const snap = FramedPanelCompositionConstants.snapColor;
    return {colors: {frame: snap(frame), inner: snap(inner)}, mouldingThickness, mouldingIsConvex};
}

export default CanvasCompositionConstants;
