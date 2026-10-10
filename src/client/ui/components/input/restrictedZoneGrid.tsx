import { useCallback, useEffect, useRef, useState } from "react";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import VolumeObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import RoomVolume from "../../../../shared/room/types/roomVolume";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import { ZoneHandle } from "../../types/zoneHandle";
import useMouseDragScroll from "../../util/mouseDragScroll";
import RestrictedZonePlanUtil from "../../util/restrictedZonePlanUtil";
import RestrictedZoneUIRect, { CELL_SIZE_PX, PLAN_INSET_PX, ZONE_RECT_MARKER_ATTRIBUTE } from "./restrictedZoneUIRect";

// Top-down room plan for editing restricted zones, like an image editor marquee: drag a zone's body
// to move it, its handles to resize; edges snap to voxels. Drawn at a fixed fingertip-friendly size
// and scrolled (fitting a phone would pile up handles). Zones come from and go back to the room; only
// the in-progress drag is local.
export default function RestrictedZoneGrid({zones, selectedObjectId, onSelect, onCommit}: Props)
{
    const panelRef = useRef<HTMLDivElement | null>(null);
    const planRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);

    // The zone being dragged, kept local so the room isn't notified every frame.
    const [draft, setDraft] = useState<{objectId: string, blocks: RoomVolume} | null>(null);

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
    const selectedIndex = zones.findIndex(zone => zone.objectId == selectedObjectId);
    useEffect(() => {
        const rect = planRef.current?.children[selectedIndex] as HTMLElement | undefined;
        rect?.scrollIntoView({block: "nearest", inline: "nearest"});
    }, [selectedObjectId]);

    const onGrab = useCallback((ev: React.PointerEvent, zone: AddObjectSignal,
        handle: ZoneHandle | "body") => {
        // Don't let the plan treat this as an empty-space press that deselects.
        ev.stopPropagation();

        (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
        dragRef.current = {
            objectId: zone.objectId,
            handle,
            blocks: VolumeObjectTypeConfig.util.getRoomVolume(zone.transform),
            startX: ev.clientX,
            startY: ev.clientY,
            wasSelected: selectedObjectId == zone.objectId,
            moved: false,
        };
        if (selectedObjectId != zone.objectId)
            onSelect(zone.objectId);
    }, [selectedObjectId, onSelect]);

    // A press on empty plan space; tap (deselect) vs. scroll is decided on release.
    const onPlanPointerDown = useCallback((ev: React.PointerEvent) => {
        dragRef.current = {
            objectId: null,
            handle: "body",
            blocks: null,
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

        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        // A drag starts only once the pointer is a whole voxel from where it went down, so a tap that
        // wobbles moves nothing, and what is dragged sets off in step with the pointer.
        if (!drag.moved && Math.abs(dx) < CELL_SIZE_PX && Math.abs(dy) < CELL_SIZE_PX)
            return;
        drag.moved = true;

        if (drag.objectId != null && drag.blocks)
        {
            setDraft({objectId: drag.objectId, blocks: RestrictedZonePlanUtil.applyDrag(drag.blocks, drag.handle,
                Math.round(dy / CELL_SIZE_PX), Math.round(dx / CELL_SIZE_PX))});
        }
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
            if (!cancelled && (drag.objectId == null || drag.wasSelected))
                onSelect(null);
            return;
        }

        const dragged = draft;
        setDraft(null);
        if (dragged)
            onCommit(dragged.objectId, dragged.blocks);
    }, [draft, onSelect, onCommit]);

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
            {zones.map(zone => <RestrictedZoneUIRect
                key={zone.objectId}
                zone={draft?.objectId == zone.objectId ? draft.blocks
                    : VolumeObjectTypeConfig.util.getRoomVolume(zone.transform)}
                selected={selectedObjectId == zone.objectId}
                onGrab={(ev, handle) => onGrab(ev, zone, handle)}
            />)}
        </div>
    </div>
}

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
    // The zone being dragged, by its object's id, or null while it is the plan itself.
    objectId: string | null;
    handle: ZoneHandle | "body";
    blocks: RoomVolume | null; // the zone's blocks as they stood when the drag began
    startX: number;
    startY: number;
    // Captured at press time, since the press itself selects the zone (otherwise a first tap would
    // immediately deselect it).
    wasSelected: boolean;
    moved: boolean;
}

interface Props
{
    zones: AddObjectSignal[]; // the room's zones, each a volume (see RestrictedZoneUtil)
    selectedObjectId: string | null;
    onSelect: (objectId: string | null) => void;
    // A zone's blocks, as they stand now that a drag of it has finished.
    onCommit: (objectId: string, blocks: RoomVolume) => void;
}
