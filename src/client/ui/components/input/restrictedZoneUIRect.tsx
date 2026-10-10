import RoomVolume from "../../../../shared/room/types/roomVolume";
import { ZoneHandle } from "../../types/zoneHandle";

export const ZONE_HANDLES: ZoneHandle[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

// Fingertip-sized handles.
export const HANDLE_SIZE_PX = 14;

// How large the plan draws a voxel, and the inset that edge handles hang into.
export const CELL_SIZE_PX = 10;
export const PLAN_INSET_PX = HANDLE_SIZE_PX / 2 + 1;

// The shortest side with room for a handle at its middle, between those at its corners.
const MIN_SIDE_WITH_MIDDLE_HANDLE_PX = 2 * CELL_SIZE_PX;

// Marks zone elements, so zone drags can be told apart from plan scrolls (see RestrictedZoneGrid).
export const ZONE_RECT_MARKER_ATTRIBUTE = "data-restricted-zone-rect";

// One zone on the plan, by the rows and columns of its blocks: a filled rectangle, with eight handles when
// selected. The grid interprets presses.
export default function RestrictedZoneUIRect({zone, selected, onGrab}: Props)
{
    // Rows map to z and columns to x, matching the room.
    const left = PLAN_INSET_PX + zone.colMin * CELL_SIZE_PX;
    const top = PLAN_INSET_PX + zone.rowMin * CELL_SIZE_PX;
    const width = (zone.colMax - zone.colMin + 1) * CELL_SIZE_PX;
    const height = (zone.rowMax - zone.rowMin + 1) * CELL_SIZE_PX;

    const handles = ZONE_HANDLES.filter(handle =>
        (width >= MIN_SIDE_WITH_MIDDLE_HANDLE_PX || (handle != "n" && handle != "s")) &&
        (height >= MIN_SIDE_WITH_MIDDLE_HANDLE_PX || (handle != "w" && handle != "e")));

    return <div
        {...{[ZONE_RECT_MARKER_ATTRIBUTE]: true}}
        className={`absolute touch-none select-none cursor-move ${selected ? SELECTED_CLASS : UNSELECTED_CLASS}`}
        style={{left, top, width, height}}
        onPointerDown={(ev) => onGrab(ev, "body")}
    >
        {selected && handles.map(handle => <div
            key={handle}
            {...{[ZONE_RECT_MARKER_ATTRIBUTE]: true}}
            className={`absolute touch-none bg-red-200 border border-red-900 rounded-xs ${HANDLE_CURSORS[handle]}`}
            style={{
                width: HANDLE_SIZE_PX,
                height: HANDLE_SIZE_PX,
                // Centred on the edge, so handles on the smallest zones stay distinguishable.
                left: `calc(${HANDLE_ANCHORS[handle].x} - ${HANDLE_SIZE_PX / 2}px)`,
                top: `calc(${HANDLE_ANCHORS[handle].y} - ${HANDLE_SIZE_PX / 2}px)`,
            }}
            onPointerDown={(ev) => onGrab(ev, handle)}
        />)}
    </div>
}

// No surface depth treatment; selection shows as a brighter edge and fill.
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
    zone: RoomVolume;
    selected: boolean;
    // A press landing on the rectangle: on one of its handles, or on the body of it.
    onGrab: (ev: React.PointerEvent, handle: ZoneHandle | "body") => void;
}
