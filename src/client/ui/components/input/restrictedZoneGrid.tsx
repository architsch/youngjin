import { useCallback, useEffect, useRef, useState } from "react";
import RestrictedZone from "../../../../shared/voxel/types/restrictedZone";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import useMouseDragScroll from "../../util/mouseDragScroll";
import RestrictedZoneUIRect, { CELL_SIZE_PX, PLAN_INSET_PX, ZONE_RECT_MARKER_ATTRIBUTE,
    ZoneHandle } from "./restrictedZoneUIRect";

// Top-down room plan for editing restricted zones, like an image editor marquee: drag a zone's body
// to move it, its handles to resize; edges snap to voxels. Drawn at a fixed fingertip-friendly size
// and scrolled (fitting a phone would pile up handles). Zones come from and go back to the room; only
// the in-progress drag is local.
export default function RestrictedZoneGrid({zones, selectedIndex, onSelect, onCommit}: Props)
{
    const panelRef = useRef<HTMLDivElement | null>(null);
    const planRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);

    // The zone being dragged, kept local so the room isn't notified every frame.
    const [draft, setDraft] = useState<{index: number, zone: RestrictedZone} | null>(null);

    // Dragging the plan scrolls it (easier than aiming at scrollbars). Presses on zones don't reach
    // this (see below).
    const onPanelRefChange = useMouseDragScroll("both", "neverGrab");
    const setPanelRef = useCallback((node: HTMLDivElement | null) => {
        panelRef.current = node;
        onPanelRefChange(node);
    }, [onPanelRefChange]);

    // Native mousedown/touchstart listeners stop presses on the plan reaching the parent ScrollPanel's
    // drag-scroll (React's stopPropagation runs too late). The component's own handlers use
    // pointerdown, which fires first and is unaffected.
    useEffect(() => {
        const panel = panelRef.current;
        const plan = planRef.current;
        if (!panel || !plan)
            return;
        panel.addEventListener("mousedown", stopPropagation);
        panel.addEventListener("touchstart", stopPropagation);
        plan.addEventListener("mousedown", stopPropagationFromZoneRect);
        plan.addEventListener("touchstart", stopPropagationFromZoneRect);

        // Open centred on the room rather than its corner.
        panel.scrollLeft = 0.5 * (panel.scrollWidth - panel.clientWidth);
        panel.scrollTop = 0.5 * (panel.scrollHeight - panel.clientHeight);

        return () => {
            panel.removeEventListener("mousedown", stopPropagation);
            panel.removeEventListener("touchstart", stopPropagation);
            plan.removeEventListener("mousedown", stopPropagationFromZoneRect);
            plan.removeEventListener("touchstart", stopPropagationFromZoneRect);
        };
    }, []);

        // Scroll a newly selected zone into view (nearest edge, so zones already visible don't move).
    useEffect(() => {
        if (selectedIndex == null)
            return;
        const rect = planRef.current?.children[selectedIndex] as HTMLElement | undefined;
        rect?.scrollIntoView({block: "nearest", inline: "nearest"});
    }, [selectedIndex]);

    const onGrab = useCallback((ev: React.PointerEvent, index: number,
        handle: ZoneHandle | "body") => {
        // Don't let the plan treat this as an empty-space press that deselects.
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

    // A press on empty plan space; tap (deselect) vs. scroll is decided on release.
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
        // A drag starts only when it would move by a whole voxel (half-voxel slack), avoiding a jump
        // that a pixel threshold would cause.
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
            // A tap on the selected zone or on empty plan deselects; a browser-cancelled press
            // (scroll takeover) doesn't.
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
        // Concave (a value holder); scrollbars always visible to signal more content.
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

// Grid drawn as background lines rather than a thousand cell elements, inset so its edge is the
// room's edge.
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

// Applies a whole-voxel drag from the drag start, so edges always snap.
function applyDrag(zone: RestrictedZone, handle: ZoneHandle | "body",
    rowDelta: number, colDelta: number): RestrictedZone
{
    if (handle == "body")
    {
        // Clamp the shift (not individual edges), so moving never resizes.
        const rowShift = clamp(rowDelta, -zone.rowMin, NUM_VOXEL_ROWS - 1 - zone.rowMax);
        const colShift = clamp(colDelta, -zone.colMin, NUM_VOXEL_COLS - 1 - zone.colMax);
        return new RestrictedZone(zone.rowMin + rowShift, zone.rowMax + rowShift,
            zone.colMin + colShift, zone.colMax + colShift);
    }

    let {rowMin, rowMax, colMin, colMax} = zone;

    // Edges stop at the opposite edge: minimum one voxel, never inverted.
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
    // Captured at press time, since the press itself selects the zone (otherwise a first tap would
    // immediately deselect it).
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
