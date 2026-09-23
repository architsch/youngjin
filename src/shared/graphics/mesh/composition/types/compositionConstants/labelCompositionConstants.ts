import FramedPanelPreset from "../compositionParams/framedPanelPreset";
import FramedPanelCompositionConstants from "./framedPanelCompositionConstants";

// A label is a framed panel whose board frames its text (see FramedPanelCompositionConstants): a plaque,
// or lettering straight on the wall when there is no frame.
const LabelCompositionConstants = {
    // Coordinated finishes, balanced as the door and canvas ones are. The inside is the plaque the text is
    // read against, so it stays pale enough for the dark default ink, as door plates do.
    presets: [
        preset("#c9a227", "#d5cdb6", 0.06, true),  // brass rim, putty plaque
        preset("#71452b", "#ded2b8", 0.08, false), // walnut, bone plaque
        preset("#74856b", "#bdb59d", 0.06, true),  // painted sage, putty plaque
        preset("#a87545", "#d8b98b", 0.08, true),  // oak, pale timber plaque
        preset("#647684", "#d5cdb6", 0.06, false), // painted slate blue, putty plaque
        preset("#5c5c5a", "#e6dcc8", 0.04, false), // slim iron, ivory plaque
        preset("#a98a3f", "#ded2b8", 0.10, true),  // old gilt, bone plaque
        preset("#845433", "#c8a271", 0.10, true),  // dark stain, light timber plaque
    ] as FramedPanelPreset[],
};

// A preset is a finish only: whether the frame is shown, and the margin, are left as they are.
function preset(frame: string, inner: string, mouldingThickness: number,
    mouldingIsConvex: boolean): FramedPanelPreset
{
    const snap = FramedPanelCompositionConstants.snapColor;
    return {colors: {frame: snap(frame), inner: snap(inner)}, mouldingThickness, mouldingIsConvex};
}

export default LabelCompositionConstants;
