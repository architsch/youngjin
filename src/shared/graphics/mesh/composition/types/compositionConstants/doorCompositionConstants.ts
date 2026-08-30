import ColorUtil from "../../../../../math/util/colorUtil";
import { DOOR_PANEL_HEIGHT, DOOR_PANEL_WIDTH } from "../../../../../system/sharedConstants";
import DoorCompositionParams from "../compositionParams/doorCompositionParams";

// The design standard every door is built to: a panelled wooden door with mouldings, of the kind
// that is recognizable as a door on sight. A door varies from its neighbours in color alone, so that
// a wall of them stays legible as a row of doors rather than as an assortment of shapes.
//
// Everything here is authored in "panel space": the origin sits at the bottom center of the visible
// panel, x runs across it and y up it, both in world units. That is the frame a joiner would measure
// a door in, and DoorCompositionBuilder is what shifts it onto the object's own origin.

const W = DOOR_PANEL_WIDTH;
const H = DOOR_PANEL_HEIGHT;

// The solid timber the panels are let into. A door's proportions live in these four numbers: the
// uprights down each side, the one between the panels, the rail underfoot, and the rail the knob
// goes through.
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

// The plate the destination room's name is written on. It is the one region finished in a color
// other than the door's own, so that it reads as something to be looked at — and it is placed where
// a sign belongs, above everything the door is made of.
const LABEL_HEIGHT = 0.39;
const LABEL_MARGIN = 0.19;
const LABEL_CENTER_Y = H - LABEL_MARGIN - 0.5 * LABEL_HEIGHT;

const UPPER_PANEL_TOP = LABEL_CENTER_Y - 0.5 * LABEL_HEIGHT - LABEL_MARGIN;

// Every part of a door is drawn as a flat quad, and quads laid over one another in the same plane
// z-fight — visibly so on the lower-precision depth buffers phones tend to have, where offsets of a
// thousandth of a unit fall below what the buffer can tell apart at the distance a door is seen
// from. So the parts are separated by an amount that is real relief rather than a nudge: a panelled
// door genuinely is built up in layers, and giving each layer the depth it would actually have costs
// nothing and settles the question on every device.
const RELIEF_STEP = 0.02;

// A region of the door's face: where it sits in panel space, how big it is, how far it stands out
// from the wall, how wide its moulding runs, and whether that moulding stands proud of the surface
// or is sunk into it. The outline of the door and its knob are raised; everything let into the face
// is sunk. That contrast is most of what makes a flat quad read as joinery.
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

    // The regions the door's face is divided into, in the order they are laid down: the slab first,
    // then everything that sits on it. The panels come in pairs, one on each side of the mid stile,
    // and are mirrored by the builder rather than being listed twice.
    // A moulding is seen entirely by the light falling across its profile, so how wide it runs is
    // how much of it there is to be seen. A band narrow enough to be taken in at a glance reads as
    // a line scored around the region rather than as timber worked into a shape, however carefully
    // it is shaded — a carving needs room across it for the light to travel. These are accordingly
    // heavy by the standards of a real door, and deliberately so.
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
    // Nearly half the knob's own half-width, which leaves it almost no flat top: what the profile
    // draws is then a dome with a rim around it, which is the shape a knob actually has.
    knob: {
        offset: {x: 0.5 * W - 0.20, y: KNOB_Y},
        size: {x: 0.11, y: 0.11},
        relief: 3 * RELIEF_STEP,
        mouldingThickness: 0.048,
        mouldingIsConvex: true,
    } as DoorRegion,

    // Coordinated finishes a door could plausibly have been given. A door's colors are drawn from
    // one of these rather than picked independently, because three unrelated colors on one door do
    // not look like a door that was painted — they look like a fault. The values are snapped to the
    // "Timber" palette the codec encodes with, so a scheme survives being written out and read back
    // unchanged; a customization form is free to set any color that palette holds.
    //
    // That palette is already only what timber is finished in, so nothing here has to steer clear of
    // colors a door was never painted. What is still chosen deliberately, and cannot be, is how the
    // three colors of one door sit against each other:
    //
    // The **panels stay in the middle of the palette's brightness range**. The material ages a color
    // by warming it and pulling its saturation back, the figure and the carving darken it further,
    // and the room it hangs in is lit by one lamp on a low ambient. A finish that starts dark has
    // nowhere to go from there: it arrives as a black rectangle with no grain and no joinery visible
    // in it, which is a door's whole appearance spent on nothing. The far end is no better — a face
    // at the top of the range washes out and takes the moulding's shading with it.
    //
    // The **plate stays close in brightness to the panel it sits on**. It only has to carry dark
    // lettering, and the smallest step that does is the one to want: a plate that leaps off the door
    // stops being part of it, and reads as a sticker rather than as something screwed to the face.
    // Measured against what the material makes of a color rather than against the hex written here,
    // a plate lands between a fifth and two thirds brighter than the door it is screwed to.
    //
    // The **knob is metal or bone**, since that is what a knob is made of, and it is the one part of
    // a door that was never painted to match the rest.
    //
    // The mouldings take no color here at all. Every one of them is worked into the timber it runs
    // around, and is seen by the light falling across its profile rather than by any contrast with
    // the face it is cut out of (see the "InstancedWood" material).
    colorSchemes: [
        scheme("#b98b56", "#d5cdb6", "#c9a227"), // pine, putty plate, brass knob
        scheme("#71452b", "#6b6659", "#a98a3f"), // dark walnut
        scheme("#a87545", "#bdb59d", "#8a7346"), // medium oak
        scheme("#87816f", "#d5cdb6", "#5c5c5a"), // weathered grey, iron knob
        scheme("#74856b", "#bdb59d", "#c9a227"), // painted sage
        scheme("#647684", "#a29b86", "#9a9a97"), // painted slate blue
        scheme("#5c6f57", "#87816f", "#a98a3f"), // painted deep green
        scheme("#8a5f56", "#a29b86", "#c9a227"), // painted oxblood
        scheme("#a89263", "#e6dcc8", "#8a7346"), // painted ochre
        scheme("#a29b86", "#f0e7d2", "#7a7a78"), // painted putty, ivory plate
        scheme("#845433", "#87816f", "#ded2b8"), // dark stain, bone knob
        scheme("#7d8f9c", "#ded2b8", "#5c5c5a"), // painted blue-grey
    ] as DoorCompositionParams["colors"][],
};

function scheme(panel: string, label: string, knob: string): DoorCompositionParams["colors"]
{
    const snap = (hex: string) => ColorUtil.paletteIndexToRGB("Timber", 
        ColorUtil.rgbToPaletteIndex("Timber", ColorUtil.hexToRGB(hex)));
    return {panel: snap(panel), label: snap(label), knob: snap(knob)};
}

export default DoorCompositionConstants;
