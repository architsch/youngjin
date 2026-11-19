import Vec3 from "../../../../../math/types/vec3";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";

// The design canvases and labels share: one moulded board over the whole footprint, whose band is the frame.
// What it frames covers the surface inside the band, or the whole footprint when there is no frame. The board
// follows whatever the object has been sized to; the band keeps its width, because the wood material
// measures it in world units.

export const FRAMED_PANEL_GEOMETRY_ID = "Square";

// The board sits just proud of its face.
export const FRAMED_PANEL_BOARD_RELIEF = 0.01;

// What the board frames sits this far in front of it, as a door's label does in front of its plate.
// Polygon offset alone leaves a coplanar layer within rounding of the board's depth, so it flickers as the
// camera's distance changes (worst on mobile depth buffers).
export const FRAMED_PANEL_CONTENT_LIFT = 0.005;

const FramedPanelCompositionConstants =
{
    // The content's extent, inside the band.
    getInnerSize: (params: FramedPanelCompositionParams, objectSize: Vec3): Vec3 =>
    {
        const band = params.framed ? params.mouldingThickness : 0;
        return {x: objectSize.x - 2 * band, y: objectSize.y - 2 * band, z: 1};
    },
};

export default FramedPanelCompositionConstants;
