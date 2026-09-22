import GraphicsManager from "../graphicsManager";
import GizmoDragHandler from "../types/gizmo/drag/gizmoDragHandler";
import GizmoDragSource from "../types/gizmo/drag/gizmoDragSource";
import { MOUSE_DRAG_THRESHOLD_PX, TOUCH_DRAG_THRESHOLD_PX } from "../../system/clientConstants";

// Canvas presses a gizmo takes instead of the camera, e.g. dragging the selected object by its outline.
// PlayerPointerInput offers every press here first, so a claimed gesture never turns the view and its
// click is never read as a tap on the world. A drag starts only once the pointer travels further than a
// tap may; a gesture released before that is cancelled rather than ended.

const sources: {[key: string]: GizmoDragSource} = {};

let active: {handler: GizmoDragHandler, pointerId: number, startX: number, startY: number,
    thresholdPx: number, dragging: boolean} | null = null;

let lastGestureClaimed = false;
let shownCursor = "";

const GizmoDragUtil =
{
    addSource: (key: string, source: GizmoDragSource): void =>
    {
        if (sources[key] != undefined)
            throw new Error(`Gizmo drag source already exists (key = ${key})`);
        sources[key] = source;
    },

    // Whether a gizmo took this press (the camera must then leave it alone).
    tryBegin: (ev: PointerEvent): boolean =>
    {
        GizmoDragUtil.cancel();
        lastGestureClaimed = false;

        const pick = pickAt(ev);
        if (pick == null)
            return false;

        active = {
            handler: pick.begin(),
            pointerId: ev.pointerId,
            startX: ev.clientX,
            startY: ev.clientY,
            thresholdPx: (ev.pointerType === "mouse") ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX,
            dragging: false,
        };
        lastGestureClaimed = true;
        showCursor(pick.cursor);
        return true;
    },

    isActive: (): boolean => active != null,

    move: (ev: PointerEvent): void =>
    {
        if (active == null || ev.pointerId !== active.pointerId)
            return;
        if (!active.dragging)
        {
            const dx = ev.clientX - active.startX;
            const dy = ev.clientY - active.startY;
            if (dx * dx + dy * dy <= active.thresholdPx * active.thresholdPx)
                return;
            active.dragging = true;
        }
        active.handler.onMove(ev);
    },

    end: (): void =>
    {
        if (active == null)
            return;
        const {handler, dragging} = active;
        active = null;
        showCursor("");
        if (dragging)
            handler.onEnd();
        else
            handler.onCancel();
    },

    cancel: (): void =>
    {
        if (active == null)
            return;
        const handler = active.handler;
        active = null;
        showCursor("");
        handler.onCancel();
    },

    // Shows, while no button is held, what a press here would grab.
    hover: (ev: PointerEvent): void =>
    {
        if (active != null)
            return;
        showCursor(pickAt(ev)?.cursor ?? "");
    },

    // Whether the gesture a click belongs to was a gizmo's.
    lastGestureWasClaimed: (): boolean => lastGestureClaimed,
}

function pickAt(ev: PointerEvent): {cursor: string, begin: () => GizmoDragHandler} | null
{
    for (const key in sources)
    {
        const pick = sources[key].pick(ev);
        if (pick != null)
            return pick;
    }
    return null;
}

function showCursor(cursor: string): void
{
    if (cursor === shownCursor)
        return;
    shownCursor = cursor;
    GraphicsManager.getGameCanvas().style.cursor = cursor;
}

export default GizmoDragUtil;
