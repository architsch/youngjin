import RestrictedZone from "../../../../shared/voxel/types/restrictedZone";

// Which edges a handle moves. A corner takes two, the middle of an edge takes one, and the body
// takes all four together — which is what makes dragging the inside of the rectangle a move rather
// than a resize.
export type ZoneHandle = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

export const ZONE_HANDLES: ZoneHandle[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

// How big a handle is drawn, in pixels: sized for a fingertip. Everything else about the plan's size
// follows from it — a voxel has to be drawn larger than this, or the handles of a small zone pile up
// on one another, and once a voxel is that large the whole room no longer fits on a phone's screen.
export const HANDLE_SIZE_PX = 14;

// How many pixels one voxel takes on the plan, and how far the plan is inset within the area that
// scrolls. The inset is what the handles of a zone lying against the wall of the room hang into,
// rather than being cut off at the panel's edge.
export const CELL_SIZE_PX = 20;
export const PLAN_INSET_PX = HANDLE_SIZE_PX / 2 + 1;

// Says that an element belongs to a zone rather than to the plan underneath it, which is how a press
// meant to drag a zone is told apart from one meant to scroll the plan (see RestrictedZoneGrid).
export const ZONE_RECT_MARKER_ATTRIBUTE = "data-restricted-zone-rect";

// One restricted zone as it is drawn on the room's plan: a filled rectangle with a bright edge,
// and — while it is the one picked out — eight handles to take hold of.
//
// It is the marquee of an image editor rather than a control of its own: it knows how to draw itself
// and where a press landed, and the grid it sits in works out what that press means.
export default function RestrictedZoneUIRect({zone, selected, onGrab}: Props)
{
    // Rows run along z and columns along x, the same way round as the room itself, so the plan is
    // laid out the way somebody standing in the room would find it.
    const left = PLAN_INSET_PX + zone.colMin * CELL_SIZE_PX;
    const top = PLAN_INSET_PX + zone.rowMin * CELL_SIZE_PX;
    const width = (zone.colMax - zone.colMin + 1) * CELL_SIZE_PX;
    const height = (zone.rowMax - zone.rowMin + 1) * CELL_SIZE_PX;

    return <div
        {...{[ZONE_RECT_MARKER_ATTRIBUTE]: true}}
        className={`absolute touch-none select-none cursor-move ${selected ? SELECTED_CLASS : UNSELECTED_CLASS}`}
        style={{left, top, width, height}}
        onPointerDown={(ev) => onGrab(ev, "body")}
    >
        {selected && ZONE_HANDLES.map(handle => <div
            key={handle}
            {...{[ZONE_RECT_MARKER_ATTRIBUTE]: true}}
            className={`absolute touch-none bg-red-200 border border-red-900 rounded-xs ${HANDLE_CURSORS[handle]}`}
            style={{
                width: HANDLE_SIZE_PX,
                height: HANDLE_SIZE_PX,
                // Straddling the edge rather than sitting inside it, so a zone only one cell wide
                // still has handles that can be told apart and taken hold of.
                left: `calc(${HANDLE_ANCHORS[handle].x} - ${HANDLE_SIZE_PX / 2}px)`,
                top: `calc(${HANDLE_ANCHORS[handle].y} - ${HANDLE_SIZE_PX / 2}px)`,
            }}
            onPointerDown={(ev) => onGrab(ev, handle)}
        />)}
    </div>
}

// The rectangle is a value drawn inside the well the plan is, so it wears neither of the surface
// treatments: what says it is picked out is a brighter edge and a stronger fill, not depth.
const UNSELECTED_CLASS = "bg-red-500/25 border-2 border-red-400/70";
const SELECTED_CLASS = "bg-red-500/45 border-3 border-red-300";

const HANDLE_ANCHORS: {[handle in ZoneHandle]: {x: string, y: string}} = {
    nw: {x: "0%",  y: "0%"},
    n:  {x: "50%", y: "0%"},
    ne: {x: "100%", y: "0%"},
    w:  {x: "0%",  y: "50%"},
    e:  {x: "100%", y: "50%"},
    sw: {x: "0%",  y: "100%"},
    s:  {x: "50%", y: "100%"},
    se: {x: "100%", y: "100%"},
};

const HANDLE_CURSORS: {[handle in ZoneHandle]: string} = {
    nw: "cursor-nwse-resize",
    n:  "cursor-ns-resize",
    ne: "cursor-nesw-resize",
    w:  "cursor-ew-resize",
    e:  "cursor-ew-resize",
    sw: "cursor-nesw-resize",
    s:  "cursor-ns-resize",
    se: "cursor-nwse-resize",
};

interface Props
{
    zone: RestrictedZone;
    selected: boolean;
    // A press landing on the rectangle: on one of its handles, or on the body of it.
    onGrab: (ev: React.PointerEvent, handle: ZoneHandle | "body") => void;
}
