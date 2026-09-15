import ColorUtil from "../../../../../math/util/colorUtil";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS_PER_STOREY } from "../../../../../system/sharedConstants";
import DoorCompositionParams from "../compositionParams/doorCompositionParams";

// The single door design (colors vary, the shape doesn't). Authored in panel space: origin at the
// panel's bottom centre, x across and y up, in world units; DoorCompositionBuilder shifts it onto the
// object origin.

export const DOOR_GEOMETRY_ID = "Square";

// Footprint (the collider, read via DoorObjectTypeConfig) vs. the drawn panel, centred and flush at
// the bottom; the difference is margin. Kept to half-voxels so stored positions stay exact (overlap
// slack is applied to the collision box instead; see PhysicsColliderStateUtil). The footprint is one
// storey tall.
export const DOOR_FOOTPRINT_WIDTH = 1.5;
export const DOOR_FOOTPRINT_HEIGHT = NUM_COLLISION_LAYERS_PER_STOREY * COLLISION_LAYER_HEIGHT; // 3.5

const W = 1.375;
const H = 3.25;

// Panel space to object origin (collider-centred): the panel bottom is half the footprint height down.
// Exported so things placed on the face (e.g. the plate label) use the same frame.
export const DOOR_PANEL_ORIGIN_Y = -0.5 * DOOR_FOOTPRINT_HEIGHT;

// The four stile/rail widths that define the door's proportions.
const SIDE_STILE = 0.16;
const MID_STILE = 0.12;
const BOTTOM_RAIL = 0.26;
const LOCK_RAIL = 0.34;

const PANEL_OUTER_X = 0.5 * W - SIDE_STILE;
const PANEL_INNER_X = 0.5 * MID_STILE;

// The knob sits a little under half way up, which is where a hand reaches for one.
const KNOB_Y = 1.45;
const LOCK_RAIL_BOTTOM = KNOB_Y - 0.5 * LOCK_RAIL;
const LOCK_RAIL_TOP = KNOB_Y + 0.5 * LOCK_RAIL;

// The name plate: the only region in a different color, placed where a sign belongs.
const LABEL_HEIGHT = 0.39;
const LABEL_MARGIN = 0.19;
const LABEL_CENTER_Y = H - LABEL_MARGIN - 0.5 * LABEL_HEIGHT;

const UPPER_PANEL_TOP = LABEL_CENTER_Y - 0.5 * LABEL_HEIGHT - LABEL_MARGIN;

// Real relief between layers (not tiny offsets), which avoids z-fighting on low-precision mobile depth
// buffers.
const RELIEF_STEP = 0.02;

// A face region: position, size, relief, moulding width, and raised or sunk (the outline and knob are
// raised; inset parts are sunk).
export interface DoorRegion
{
    offset: {x: number, y: number},
    size: {x: number, y: number},
    relief: number,
    mouldingThickness: number,
    mouldingIsConvex: boolean,
}

const DoorCompositionConstants = {
    panelWidth: W,
    panelHeight: H,

    // Regions in draw order (slab first); mirrored panels are added by the builder. Moulding bands are
    // intentionally wide so the relief shading reads.
    slab: {
        offset: {x: 0, y: 0.5 * H},
        size: {x: W, y: H},
        relief: RELIEF_STEP,
        mouldingThickness: 0.105, // the heaviest trim on the door, as the outer frame is on a real one
        mouldingIsConvex: true,
    } as DoorRegion,
    lowerPanel: {
        offset: {x: 0.5 * (PANEL_OUTER_X + PANEL_INNER_X), y: 0.5 * (BOTTOM_RAIL + LOCK_RAIL_BOTTOM)},
        size: {x: PANEL_OUTER_X - PANEL_INNER_X, y: LOCK_RAIL_BOTTOM - BOTTOM_RAIL},
        relief: 2 * RELIEF_STEP,
        mouldingThickness: 0.075,
        mouldingIsConvex: false,
    } as DoorRegion,
    upperPanel: {
        offset: {x: 0.5 * (PANEL_OUTER_X + PANEL_INNER_X), y: 0.5 * (LOCK_RAIL_TOP + UPPER_PANEL_TOP)},
        size: {x: PANEL_OUTER_X - PANEL_INNER_X, y: UPPER_PANEL_TOP - LOCK_RAIL_TOP},
        relief: 2 * RELIEF_STEP,
        mouldingThickness: 0.075,
        mouldingIsConvex: false,
    } as DoorRegion,
    label: {
        offset: {x: 0, y: LABEL_CENTER_Y},
        size: {x: 1.0, y: LABEL_HEIGHT},
        relief: 2 * RELIEF_STEP,
        mouldingThickness: 0.062,
        mouldingIsConvex: false,
    } as DoorRegion,
    // A moulding nearly half the knob's width, which reads as a dome with a rim.
    knob: {
        offset: {x: 0.5 * W - 0.20, y: KNOB_Y},
        size: {x: 0.11, y: 0.11},
        relief: 3 * RELIEF_STEP,
        mouldingThickness: 0.048,
        mouldingIsConvex: true,
    } as DoorRegion,

    // Coordinated finishes (snapped to the "Timber" palette so they round-trip). Unrelated colors look
    // like a fault. Panels stay mid-brightness (the aging material makes dark finishes black and pale
    // ones wash out); the plate stays close to the panel's brightness; the knob is metal or bone.
    // Mouldings take no color of their own (see the "InstancedWood" material).
    presets: [
        preset("#b98b56", "#d5cdb6", "#c9a227"), // pine, putty plate, brass knob
        preset("#71452b", "#6b6659", "#a98a3f"), // dark walnut
        preset("#a87545", "#bdb59d", "#8a7346"), // medium oak
        preset("#87816f", "#d5cdb6", "#5c5c5a"), // weathered grey, iron knob
        preset("#74856b", "#bdb59d", "#c9a227"), // painted sage
        preset("#647684", "#a29b86", "#9a9a97"), // painted slate blue
        preset("#5c6f57", "#87816f", "#a98a3f"), // painted deep green
        preset("#8a5f56", "#a29b86", "#c9a227"), // painted oxblood
        preset("#a89263", "#e6dcc8", "#8a7346"), // painted ochre
        preset("#a29b86", "#f0e7d2", "#7a7a78"), // painted putty, ivory plate
        preset("#845433", "#87816f", "#ded2b8"), // dark stain, bone knob
        preset("#7d8f9c", "#ded2b8", "#5c5c5a"), // painted blue-grey
    ] as DoorCompositionParams["colors"][],
};

function preset(panel: string, label: string, knob: string): DoorCompositionParams["colors"]
{
    const snap = (hex: string) => ColorUtil.paletteIndexToRGB("Timber", 
        ColorUtil.rgbToPaletteIndex("Timber", ColorUtil.hexToRGB(hex)));
    return {panel: snap(panel), label: snap(label), knob: snap(knob)};
}

export default DoorCompositionConstants;
