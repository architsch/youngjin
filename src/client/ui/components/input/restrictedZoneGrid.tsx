import { useCallback, useEffect, useRef, useState } from "react";
import RestrictedZone from "../../../../shared/voxel/types/restrictedZone";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import useMouseDragScroll from "../../util/mouseDragScroll";
import RestrictedZoneUIRect, { CELL_SIZE_PX, PLAN_INSET_PX, ZONE_RECT_MARKER_ATTRIBUTE,
    ZoneHandle } from "./restrictedZoneUIRect";

// The room's plan, seen from above, with its restricted zones drawn on it — a marquee selection in
// an image editor rather than anything the rest of this UI has: a rectangle is dragged about by its
// middle and resized by its edges, and every edge snaps to a voxel.
//
// The plan is drawn at a fixed size and scrolled to rather than fitted to the panel. A room is
// thirty-odd voxels across, so fitting one to a phone's screen leaves each voxel a few pixels wide
// and the handles of a small zone piled on top of one another — and the handles are the whole of how
// a zone is shaped. Drawn at a size a fingertip can tell apart, the plan is simply bigger than the
// panel, which is what the scrolling is for.
//
// The zones are handed in and handed back rather than kept here, because they belong to the room
// rather than to this component: what the grid owns is only the rectangle currently being dragged,
// which is not a zone yet.
export default function RestrictedZoneGrid({zones, selectedIndex, onSelect, onCommit}: Props)
{
    const panelRef = useRef<HTMLDivElement | null>(null);
    const planRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);

    // The zone being dragged, as it currently stands. Kept apart from the room's own list so that a
    // drag can be followed on screen without the room being told about every frame of it.
    const [draft, setDraft] = useState<{index: number, zone: RestrictedZone} | null>(null);

    // Dragging the plan scrolls it, which is the other half of drawing it larger than the panel: a
    // scrollbar is a poor thing to aim at with a thumb. What keeps this from also dragging whichever
    // zone the press landed on is that such a press never reaches the panel — see below.
    const onPanelRefChange = useMouseDragScroll("both", "neverGrab");
    const setPanelRef = useCallback((node: HTMLDivElement | null) => {
        panelRef.current = node;
        onPanelRefChange(node);
    }, [onPanelRefChange]);

    // Keep the press from reaching the form's own drag-to-scroll (see useMouseDragScroll), which
    // would otherwise read a drag across the plan as a scroll of the form. This panel scrolls
    // instead, and a press meant for one of the two cannot be meant for the other.
    //
    // These must be native listeners: React delegates its own events at the root container, above
    // the form, so a React-level stopPropagation would run too late. They are on mousedown and
    // touchstart rather than pointerdown, which is the event this component's own handlers are built
    // on and which fires first — so stopping these leaves those untouched. Stopping an event does
    // not stop the other listeners on the same element, so the panel's own scrolling is untouched
    // too; what it stops is the panel's scrolling reading a press that landed on a zone.
    useEffect(() => {
        const panel = panelRef.current;
        const plan = planRef.current;
        if (!panel || !plan)
            return;
        panel.addEventListener("mousedown", stopPropagation);
        panel.addEventListener("touchstart", stopPropagation);
        plan.addEventListener("mousedown", stopPropagationFromZoneRect);
        plan.addEventListener("touchstart", stopPropagationFromZoneRect);

        // Opened onto the middle of the room rather than onto its north-west corner, which is where
        // a scrolled panel otherwise starts and is the one part of a room nothing is ever built
        // against.
        panel.scrollLeft = 0.5 * (panel.scrollWidth - panel.clientWidth);
        panel.scrollTop = 0.5 * (panel.scrollHeight - panel.clientHeight);

        return () => {
            panel.removeEventListener("mousedown", stopPropagation);
            panel.removeEventListener("touchstart", stopPropagation);
            plan.removeEventListener("mousedown", stopPropagationFromZoneRect);
            plan.removeEventListener("touchstart", stopPropagationFromZoneRect);
        };
    }, []);

    // A zone that has just been picked out is brought into view, which is what makes a newly drawn
    // one findable: it is laid down in the middle of the room, and the middle of the room need not
    // be the part of it the panel is showing. Asking for the nearest edge rather than for the centre
    // means a zone already in view is left exactly where it is, so this does nothing at all when the
    // user picks one out by pressing on it.
    useEffect(() => {
        if (selectedIndex == null)
            return;
        const rect = planRef.current?.children[selectedIndex] as HTMLElement | undefined;
        rect?.scrollIntoView({block: "nearest", inline: "nearest"});
    }, [selectedIndex]);

    const onGrab = useCallback((ev: React.PointerEvent, index: number,
        handle: ZoneHandle | "body") => {
        // The press belongs to the rectangle, so the plan underneath must not also read it as a
        // press on empty space and drop the selection.
        ev.stopPropagation();

        (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
        dragRef.current = {
            index,
            handle,
            zone: zones[index],
            startX: ev.clientX,
            startY: ev.clientY,
            wasSelected: selectedIndex == index,
            moved: false,
        };
        if (selectedIndex != index)
            onSelect(index);
    }, [zones, selectedIndex, onSelect]);

    // A press on the plan itself rather than on one of the zones drawn over it. Whether that is a
    // tap — which lets go of whatever was picked out — or the beginning of a scroll is not known
    // yet, so nothing is decided until the press ends.
    const onPlanPointerDown = useCallback((ev: React.PointerEvent) => {
        dragRef.current = {
            index: NO_ZONE,
            handle: "body",
            zone: null,
            startX: ev.clientX,
            startY: ev.clientY,
            wasSelected: false,
            moved: false,
        };
    }, []);

    const onPointerMove = useCallback((ev: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag)
            return;

        const rowDelta = Math.round((ev.clientY - drag.startY) / CELL_SIZE_PX);
        const colDelta = Math.round((ev.clientX - drag.startX) / CELL_SIZE_PX);
        // A drag is recognised exactly when it would move something, rather than after a threshold
        // of its own. A threshold measured in pixels would have to be crossed before the first whole
        // voxel of travel counted, and everything crossed on the way would then arrive at once — the
        // zone jumping several voxels the moment it began following the pointer. Half a voxel of
        // slack is enough to tell a tap from a drag, and it is the same half voxel the rounding
        // already allows for.
        if (rowDelta == 0 && colDelta == 0)
            return;
        drag.moved = true;

        if (drag.zone)
            setDraft({index: drag.index, zone: applyDrag(drag.zone, drag.handle, rowDelta, colDelta)});
    }, []);

    const endDrag = useCallback((cancelled: boolean) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag)
            return;

        if (!drag.moved)
        {
            // A tap rather than a drag. Tapping the zone already picked out is how it is let go of,
            // the same way clicking the thing being edited in the world drops it — and so is tapping
            // the plan around it. A press the browser took over in order to scroll with is neither
            // of those, so a cancelled one lets go of nothing.
            if (!cancelled && (drag.index == NO_ZONE || drag.wasSelected))
                onSelect(null);
            return;
        }

        const dragged = draft;
        setDraft(null);
        if (dragged)
        {
            const next = zones.slice();
            next[dragged.index] = dragged.zone;
            onCommit(next);
        }
    }, [draft, zones, onSelect, onCommit]);

    return <div
        ref={setPanelRef}
        // Concave, because the plan is something the user puts a value into rather than a slab with
        // controls resting on it. The bars are kept on show rather than left to fade in with a
        // scroll, since they are what says there is more of the room than the panel is showing.
        className="shrink-0 self-center rounded-md bg-gray-800 select-none overflow-auto
            yj-surface-concave yj-visible-scrollbar w-[min(74vw,42vh,340px)] aspect-square"
    >
        <div
            ref={planRef}
            className="relative"
            style={planStyle}
            onPointerDown={onPlanPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => endDrag(false)}
            onPointerCancel={() => endDrag(true)}
        >
            {zones.map((zone, index) => <RestrictedZoneUIRect
                key={index}
                zone={draft?.index == index ? draft.zone : zone}
                selected={selectedIndex == index}
                onGrab={(ev, handle) => onGrab(ev, index, handle)}
            />)}
        </div>
    </div>
}

// Stands for "the plan itself" where a zone's index would otherwise go.
const NO_ZONE = -1;

const GRID_LINE_COLOR = "rgba(255,255,255,0.09)";
const planWidthPx = NUM_VOXEL_COLS * CELL_SIZE_PX;
const planHeightPx = NUM_VOXEL_ROWS * CELL_SIZE_PX;

// The voxel grid drawn as lines rather than as a cell per voxel: a room is a thousand cells, and a
// thousand elements laid out behind a rectangle that is dragged across them is a thousand elements
// the browser has to keep. The lines are laid inside the inset the handles hang into, so that the
// edge of the drawn grid is the edge of the room rather than the edge of what scrolls.
const planStyle: React.CSSProperties = {
    width: planWidthPx + 2 * PLAN_INSET_PX,
    height: planHeightPx + 2 * PLAN_INSET_PX,
    backgroundImage:
        `repeating-linear-gradient(to right, ${GRID_LINE_COLOR} 0 1px, transparent 1px ${CELL_SIZE_PX}px), ` +
        `repeating-linear-gradient(to bottom, ${GRID_LINE_COLOR} 0 1px, transparent 1px ${CELL_SIZE_PX}px)`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${PLAN_INSET_PX}px ${PLAN_INSET_PX}px`,
    backgroundSize: `${planWidthPx}px ${planHeightPx}px`,
};

// Where a zone ends up once a handle has been carried the given number of voxels. Everything is
// counted in whole voxels from the start of the drag, which is what makes the edges snap: there is
// no unsnapped position for them to be rounded back from.
function applyDrag(zone: RestrictedZone, handle: ZoneHandle | "body",
    rowDelta: number, colDelta: number): RestrictedZone
{
    if (handle == "body")
    {
        // Carried whole. The offset is pulled back to what the room has room for rather than the
        // leading edge being stopped while the trailing one keeps going, which would resize a zone
        // that was being moved.
        const rowShift = clamp(rowDelta, -zone.rowMin, NUM_VOXEL_ROWS - 1 - zone.rowMax);
        const colShift = clamp(colDelta, -zone.colMin, NUM_VOXEL_COLS - 1 - zone.colMax);
        return new RestrictedZone(zone.rowMin + rowShift, zone.rowMax + rowShift,
            zone.colMin + colShift, zone.colMax + colShift);
    }

    let {rowMin, rowMax, colMin, colMax} = zone;

    // An edge is stopped against the opposite one rather than allowed past it, so a zone can be
    // shrunk down to a single voxel but never turned inside out.
    if (handle == "nw" || handle == "n" || handle == "ne")
        rowMin = clamp(rowMin + rowDelta, 0, rowMax);
    if (handle == "sw" || handle == "s" || handle == "se")
        rowMax = clamp(rowMax + rowDelta, rowMin, NUM_VOXEL_ROWS - 1);
    if (handle == "nw" || handle == "w" || handle == "sw")
        colMin = clamp(colMin + colDelta, 0, colMax);
    if (handle == "ne" || handle == "e" || handle == "se")
        colMax = clamp(colMax + colDelta, colMin, NUM_VOXEL_COLS - 1);

    return new RestrictedZone(rowMin, rowMax, colMin, colMax);
}

function clamp(n: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, n));
}

function stopPropagation(ev: Event): void
{
    ev.stopPropagation();
}

function stopPropagationFromZoneRect(ev: Event): void
{
    if ((ev.target as Element | null)?.closest(`[${ZONE_RECT_MARKER_ATTRIBUTE}]`))
        ev.stopPropagation();
}

interface DragState
{
    // Which zone is being dragged, or NO_ZONE while it is the plan itself.
    index: number;
    handle: ZoneHandle | "body";
    zone: RestrictedZone | null; // the zone as it stood when the drag began
    startX: number;
    startY: number;
    // Whether the zone was already the one picked out when the press landed. Asked of the press
    // rather than of the moment it ends, because a press on a zone picks that zone out — so by the
    // time the press ends every zone "was" selected, and a first tap on one would let go of it again
    // as quickly as it took hold.
    wasSelected: boolean;
    moved: boolean;
}

interface Props
{
    zones: RestrictedZone[];
    selectedIndex: number | null;
    onSelect: (index: number | null) => void;
    // The whole list, as it stands now that a drag has finished.
    onCommit: (zones: RestrictedZone[]) => void;
}
