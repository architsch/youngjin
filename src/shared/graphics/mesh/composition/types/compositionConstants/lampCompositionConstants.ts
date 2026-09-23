import FramedPanelPreset from "../compositionParams/framedPanelPreset";
import FramedPanelCompositionConstants from "./framedPanelCompositionConstants";

// A lamp is a framed panel whose board frames a glow (see FramedPanelCompositionConstants). The footprint
// (and so what the lamp claims of its face) doesn't change with the margin.
const LampCompositionConstants = {
    // Coordinated finishes, balanced as the door and canvas ones are. Every new lamp starts as the first:
    // a bare glow over its whole footprint, keeping the second's finish for when a frame is turned on.
    presets: [
        preset("#c9a227", 0.06, true, false, 0),     // bare glow
        preset("#c9a227", 0.06, true, true, 0),      // brass rim
        preset("#71452b", 0.08, false, true, 0.05),  // walnut
        preset("#d5cdb6", 0.06, true, true, 0.1),    // painted putty
        preset("#5c5c5a", 0.04, false, true, 0.1),   // slim iron
        preset("#a87545", 0.1, true, true, 0.05),    // oak
        preset("#74856b", 0.06, false, true, 0.15),  // painted sage
        preset("#a98a3f", 0.08, true, true, 0.1),    // old gilt
        preset("#647684", 0.04, true, true, 0.2),    // painted slate blue
    ] as FramedPanelPreset[],
};

function preset(frame: string, mouldingThickness: number, mouldingIsConvex: boolean, framed: boolean,
    margin: number): FramedPanelPreset
{
    return {colors: {frame: FramedPanelCompositionConstants.snapColor(frame)}, mouldingThickness,
        mouldingIsConvex, framed, margin};
}

export default LampCompositionConstants;
