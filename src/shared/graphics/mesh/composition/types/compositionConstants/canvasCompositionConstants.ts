import ColorUtil from "../../../../../math/util/colorUtil";
import Vec3 from "../../../../../math/types/vec3";
import CanvasCompositionParams from "../compositionParams/canvasCompositionParams";
import MarginCompositionConstants from "./marginCompositionConstants";

// The single canvas design: one moulded board, a margin inside the footprint (see
// MarginCompositionConstants). Its band is the frame and the picture covers the surface inside it (see
// CanvasGameObject), so the inner color shows around a letterboxed picture. Colors, moulding and margin
// vary; the shape doesn't. A canvas without a frame has no board at all, and its picture covers what the
// board would.

export const CANVAS_GEOMETRY_ID = "Square";

// The board sits just proud of the wall.
export const CANVAS_BOARD_RELIEF = 0.01;

// The picture's real gap in front of the board, as a door's label has in front of its plate. Polygon offset
// alone leaves a coplanar picture within rounding of the board's depth, so it flickers as the camera's
// distance changes (worst on mobile depth buffers).
export const CANVAS_PICTURE_LIFT = 0.005;

const CanvasCompositionConstants = {
    // Band widths are the shared ones (see MouldingCompositionConstants).

    // The board's extent (band included), or the picture's when there is no frame.
    getDrawnSize: (params: CanvasCompositionParams, objectSize: Vec3): Vec3 =>
    {
        const band = params.framed ? params.mouldingThickness : 0;
        return {
            x: MarginCompositionConstants.getDrawnSize(objectSize.x, params.margin, band),
            y: MarginCompositionConstants.getDrawnSize(objectSize.y, params.margin, band),
            z: 1,
        };
    },

    // The picture's extent, inside the band.
    getPictureSize: (params: CanvasCompositionParams, objectSize: Vec3): Vec3 =>
    {
        const band = params.framed ? params.mouldingThickness : 0;
        const drawnSize = CanvasCompositionConstants.getDrawnSize(params, objectSize);
        return {x: drawnSize.x - 2 * band, y: drawnSize.y - 2 * band, z: 1};
    },

    // Coordinated finishes (snapped to the "Timber" palette so they round-trip). Frames stay
    // mid-brightness, as on doors (see DoorCompositionConstants); the inner stays a quieter mid-tone,
    // since a pale one outshines the frame and a dark one reads as a hole around the picture.
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
    ] as Omit<CanvasCompositionParams, "framed" | "margin">[],
};

// A preset is a finish only: whether the frame is shown, and the margin, are left as they are.
function preset(frame: string, inner: string, mouldingThickness: number,
    mouldingIsConvex: boolean): Omit<CanvasCompositionParams, "framed" | "margin">
{
    const snap = (hex: string) => ColorUtil.paletteIndexToRGB("Timber",
        ColorUtil.rgbToPaletteIndex("Timber", ColorUtil.hexToRGB(hex)));
    return {colors: {frame: snap(frame), inner: snap(inner)}, mouldingThickness, mouldingIsConvex};
}

export default CanvasCompositionConstants;
