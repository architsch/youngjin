import ColorUtil from "../../../../../math/util/colorUtil";
import LampCompositionParams from "../compositionParams/lampCompositionParams";

// The single lamp design: a glowing square, optionally inside a moulded band, drawn a margin inside the
// footprint (see MarginCompositionConstants). The footprint (and so what the lamp claims of its face)
// doesn't change with the margin, and neither does the band, which the wood material measures in world
// units.

export const LAMP_GEOMETRY_ID = "Square";

// The lamp sits just proud of its face, and the glow just proud of the band around it (as a canvas's
// picture sits in front of its board).
export const LAMP_BOARD_RELIEF = 0.01;
export const LAMP_GLOW_LIFT = 0.005;

const LampCompositionConstants = {
    // Coordinated finishes (snapped to the "Timber" palette so they round-trip), balanced as the door and
    // canvas ones are. Every new lamp starts as the first: a bare glow over its whole footprint, keeping
    // the second's finish for when a frame is turned on.
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
    ] as LampCompositionParams[],
};

function preset(frame: string, mouldingThickness: number, mouldingIsConvex: boolean, framed: boolean,
    margin: number): LampCompositionParams
{
    const snapped = ColorUtil.paletteIndexToRGB("Timber",
        ColorUtil.rgbToPaletteIndex("Timber", ColorUtil.hexToRGB(frame)));
    return {colors: {frame: snapped}, mouldingThickness, mouldingIsConvex, framed, margin};
}

export default LampCompositionConstants;
