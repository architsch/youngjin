import ColorUtil from "../../../../../math/util/colorUtil";
import Vec3 from "../../../../../math/types/vec3";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";
import FramedPanelPreset from "../compositionParams/framedPanelPreset";
import MarginCompositionConstants from "./marginCompositionConstants";

// The design canvases, lamps and labels share: one moulded board, drawn a margin inside the footprint (see
// MarginCompositionConstants), whose band is the frame. What it frames covers the surface inside the band,
// or what the board would cover when there is no frame. The board follows whatever the object has been sized
// to; the band keeps its width, because the wood material measures it in world units.

export const FRAMED_PANEL_GEOMETRY_ID = "Square";

// The board sits just proud of its face.
export const FRAMED_PANEL_BOARD_RELIEF = 0.01;

// What the board frames sits this far in front of it, as a door's label does in front of its plate.
// Polygon offset alone leaves a coplanar layer within rounding of the board's depth, so it flickers as the
// camera's distance changes (worst on mobile depth buffers).
export const FRAMED_PANEL_CONTENT_LIFT = 0.005;

const FramedPanelCompositionConstants =
{
    // The board's extent (band included), or the content's when there is no frame.
    getDrawnSize: (params: FramedPanelCompositionParams, objectSize: Vec3): Vec3 =>
    {
        const band = params.framed ? params.mouldingThickness : 0;
        return {
            x: MarginCompositionConstants.getDrawnSize(objectSize.x, params.margin, band),
            y: MarginCompositionConstants.getDrawnSize(objectSize.y, params.margin, band),
            z: 1,
        };
    },

    // The content's extent, inside the band.
    getInnerSize: (params: FramedPanelCompositionParams, objectSize: Vec3): Vec3 =>
    {
        const band = params.framed ? params.mouldingThickness : 0;
        const drawnSize = FramedPanelCompositionConstants.getDrawnSize(params, objectSize);
        return {x: drawnSize.x - 2 * band, y: drawnSize.y - 2 * band, z: 1};
    },

    // Preset colors are snapped to the "Timber" palette, so a preset survives the codec's round trip.
    snapColor: (hex: string): Vec3 =>
    {
        return ColorUtil.paletteIndexToRGB("Timber", ColorUtil.rgbToPaletteIndex("Timber", ColorUtil.hexToRGB(hex)));
    },

    // Applies an authored look: its finish, and whether it is framed and its margin where it says. Copied
    // in, so later edits don't reach the preset.
    applyPreset: (params: FramedPanelCompositionParams, preset: FramedPanelPreset): void =>
    {
        params.colors = {...params.colors};
        for (const slot of ["frame", "inner"] as const)
        {
            const color = preset.colors[slot];
            if (color != undefined)
                params.colors[slot] = {...color};
        }
        params.mouldingThickness = preset.mouldingThickness;
        params.mouldingIsConvex = preset.mouldingIsConvex;
        if (preset.framed != undefined)
            params.framed = preset.framed;
        if (preset.margin != undefined)
            params.margin = preset.margin;
    },
};

export default FramedPanelCompositionConstants;
